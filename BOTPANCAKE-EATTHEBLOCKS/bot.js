const ethers = require('ethers');

const addresses = {
  WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  recipient: 'recipient of the profit here'
}

//First address of this mnemonic must have enough BNB to pay for tx fess
const mnemonic = 'your mnemonic here, to send';
//we r gonna create a connection to the BSC by using the line of code down below
const provider = new ethers.providers.WebSocketProvider('Ankr websocket url to mainnet');
const wallet = ethers.Wallet.fromMnemonic(mnemonic); //we create a wallet object with the ethers library, this will allow us to sign tx
const account = wallet.connect(provider); //then we connect this wallet object to our provider
const factory = new ethers.Contract(
  addresses.factory, //we need the address from the factory
  ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'], //this is the ABI , en ethers no hace falta poner todo el tocho
  account //the address that we wanna use to sign tx
);
const router = new ethers.Contract(
  addresses.router, //we need the address of the router
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
  ],
  account
);

const wbnb = new ethers.Contract(
  addresses.WBNB,
  [
    'function approve(address spender, uint amount) public returns(bool)',
  ],
  account
);

const init = async () => {
  const tx = await wbnb.approve(
    router.address, 
    'replace by amount covering several trades'
  );
  const receipt = await tx.wait(); 
  console.log('Transaction receipt');
  console.log(receipt);
}
//the factory object is where we r gonna listen to the 'PairCreate' event, so that´s mean that a new liquidty pool is created
//and everytime this event is emitted it´s going to call back the console.log and it´s gonna pass it a different field of the 
//pair created event and also the pair address of both(DAI-BNB LP)
factory.on('PairCreated', async (token0, token1, pairAddress) => {
  console.log(`
    New pair detected
    =================
    token0: ${token0}
    token1: ${token1}
    pairAddress: ${pairAddress}
  `);

  //The quote currency needs to be WBNB (we will pay with WBNB) OJO Q NO LO LISTEN CON OTRO PAR XD SINO HAY Q CAMBIARLO
  let tokenIn, tokenOut;
  if(token0 === addresses.WBNB) {
    tokenIn = token0; 
    tokenOut = token1;
  }

  if(token1 == addresses.WBNB) {
    tokenIn = token1; 
    tokenOut = token0;
  }

  //The quote currency is not WBNB
  if(typeof tokenIn === 'undefined') {
    return;
  }

  //We buy for 0.1 BNB of the new token
  //ethers was originally created for Ethereum, both also work for BSC
  //'ether' === 'bnb' on BSC
  const amountIn = ethers.utils.parseUnits('0.1', 'ether');
  const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]); //esto es para saber cuanto token queremos de output,amountIn es el bnb q ponemos, token in is bnb, token out es lo qq vamos a comprar
  //Our execution price will be a bit different, we need some flexbility
  const amountOutMin = amounts[1].sub(amounts[1].div(10));   //aqui es por ejemplo nosotros queremos 100 SAFEMOONS, pues aqui marcamos que almenos consigamos 90 SAFEMOONS
  console.log(`   //we are gonna console log the details of our trade...
    Buying new token
    =================
    tokenIn: ${amountIn.toString()} ${tokenIn} (WBNB)
    tokenOut: ${amounOutMin.toString()} ${tokenOut}
  `);
  const tx = await router.swapExactTokensForTokens(  //after we r gonna send our tx to buy token and for that we call swap exact tokens for tokens that means that in amount In ponemos si o si una cantidad exacta, pero el outmin es x ej q al menos recibamos 90 safemoons
    amountIn,
    amountOutMin,
    [tokenIn, tokenOut],
    addresses.recipient,
    Date.now() + 1000 * 60 * 10 //esta especificado en milisegundos//10 minutes. We need to specify the deadline, x ej podemos poner deadline de 30 sec, q se haga en 30 sec o nada
  );
  const receipt = await tx.wait(); 
  console.log('Transaction receipt');
  console.log(receipt);
});

init();
