
const wax = new waxjs.WaxJS({
    rpcEndpoint: 'https://wax.greymass.com'
});
// const wax = new waxjs.WaxJS({
//   rpcEndpoint: 'http://wax-all.test:8888',
//   tryAutoLogin: true,
//   waxSigningURL: 'http://all-access.wax.test:8113',
//   waxAutoSigningURL: 'http://idm.wax.test:8113/v1/accounts/auto-accept/'
// });

async function login() {
    try {
        const userAccount = await wax.login();
        window.alert("Voila we did it...");
    } catch (e) {
        window.alert(e);
    }
}
