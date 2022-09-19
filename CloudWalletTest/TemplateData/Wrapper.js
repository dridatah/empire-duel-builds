const wax = new waxjs.WaxJS({
    rpcEndpoint: 'https://wax.greymass.com'
  });

  async function waxLoginWrapper() {
    try {
      const userAccount = await wax.login();
      window.prompt(userAccount);
    } catch(e) {
    }
  }