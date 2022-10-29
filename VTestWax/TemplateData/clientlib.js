var EmpireWaxClient = (function() {
  const TESTNET_AA_ENDPOINT = "https://test.wax.api.atomicassets.io";
  const MAINNET_AA_ENDPOINT = "https://api.waxtest.alohaeos.com";
  const TESTNET_ENDPOINT = "https://api.waxtest.alohaeos.com";
  const MAINNET_ENDPOINT = "https://api.waxtest.alohaeos.com";
  const TEST_CHAIN_ID =
    "f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12";
  const MAINNET_CHAIN_ID =
    "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4";
  const GAME_CONTRACT = "empireduelsg";
  const TOKEN_CONTRACT = "empireduelst";

  const COLLECTION_NAME = "empireduelsx";

  var instance;
  var _anchorSession = null;
  var aaAPI = null;
  var waxInstance = null;
  var waxActor = null;
  var waxWallet = null;

  function createInstance(isTest) {
    return {
      setWaxAddress: v => {
        waxActor = v;
      },
      setIsAnchorWallet: isAnchor => {
        waxWallet = isAnchor ? "anchor" : "cloud";
      },
      getWaxAddress: () => waxActor,
      isAnchorWallet: () => waxWallet === "anchor",
      isAnchorError: e => e === "anchorerr",
      getTokenBalance: async (waxAddress = null) => {
        waxAddress = waxAddress ? waxAddress : waxActor;
        if (!waxAddress) {
          return -1;
        }
        const result = await instance.getTokenRowScoped(
          "accounts",
          waxAddress,
          1
        );
        return result.rows[0]
          ? Number(result.rows[0].balance.split(" ")[0])
          : 0;
      },
      loginWithCloud: async () => {
        try {
          const wax = instance.connectCloud();
          await wax.login();
          waxActor = wax.userAccount;
          waxWallet = "cloud";
        } catch (e) {
          console.log(e);
        }
      },
      loginWithAnchor: async () => {
        const anchorLink = instance.connectAnchor();
        const result = await anchorLink.login(GAME_CONTRACT);
        if (result.session && result.session.auth) {
          _anchorSession = result.session;
          waxActor = result.session.auth.actor.toString();
          waxWallet = "anchor";
        }
      },
      validate: async (waxAddress, uniqueCode) => {
        return await instance.gameAction("validate", {
          user: waxAddress,
          code: uniqueCode
        });
      },
      // FETCHING FUNCTIONS
      getAssets: async (schema, page, limit = 10) => {
        // check node_modules/atomicassets/build/API/Explorer/index.js file
        // for all simplified usage of the AA API
        const aa = instance.getAA();
        return await aa.getAssets({
          collection_name: COLLECTION_NAME,
          schema_name: schema,
          owner: waxActor,
          page: page,
          limit: limit
        });
      },
      getAsset: async id => {
        // check node_modules/atomicassets/build/API/Explorer/index.js file
        // for all simplified usage of the AA API
        const aa = instance.getAA();
        return await aa.getAsset(id);
      },
      getGameRow: async (table, pid) => {
        return await instance.getRow(table, pid, GAME_CONTRACT, GAME_CONTRACT);
      },
      getGameRowScoped: async (table, scope, pid) => {
        return await instance.getRow(table, pid, scope, GAME_CONTRACT);
      },
      getGameTable: async table => {
        return await instance.getTable(table, GAME_CONTRACT, GAME_CONTRACT);
      },
      getGameTableScoped: async (table, scope) => {
        return await instance.getTable(table, scope, GAME_CONTRACT);
      },
      getGameTableForUser: async table => {
        return await instance.getTable(table, waxActor, GAME_CONTRACT);
      },
      getTokenRow: async (table, pid) => {
        return await instance.getRow(
          table,
          pid,
          TOKEN_CONTRACT,
          TOKEN_CONTRACT
        );
      },
      getTokenRowScoped: async (table, scope, pid) => {
        return await instance.getRow(table, pid, scope, TOKEN_CONTRACT);
      },
      // low level
      requestAA: async (pathPart, data) => {
        const aa = instance.getAA();
        return await aa.fetchEndpoint("/v1/" + pathPart, data);
      },
      requestAAForAccount: async (pathPart, data) => {
        const aa = instance.getAA();
        return await aa.fetchEndpoint("/v1/" + pathPart + "/" + waxActor, data);
      },
      getRow: async (table, pid, scope, code) => {
        try {
          var result = await instance.connectCloud().rpc.get_table_rows({
            json: true,
            code: code,
            scope: scope,
            table: table,
            lower_bound: pid,
            reverse: false,
            show_payer: false
          });
          return { rows: result.rows, isError: false };
        } catch (e) {
          return {
            rows: [],
            isError: true,
            errorMessage: e.message,
            errorCode: e.code
          };
        }
      },
      getTable: async (table, scope, code, limit = 100, isReverse = false) => {
        try {
          var result = await instance.connectCloud().rpc.get_table_rows({
            json: true,
            code: code,
            scope: scope,
            table: table,
            reverse: isReverse,
            show_payer: false,
            limit: limit
          });
          return { rows: result.rows, isError: false };
        } catch (e) {
          return {
            rows: [],
            isError: true,
            errorMessage: e.message,
            errorCode: e.code
          };
        }
      },
      // RUN ACTION FUNCTIONS
      transferAssets: async (assetIds, memo = "") => {
        return await instance.runAction("atomicassets", "transfer", {
          from: waxActor,
          to: GAME_CONTRACT,
          asset_ids: assetIds,
          memo
        });
      },
      transferToken: async (quantity, memo = "") => {
        // quantity 6 precision asset: 10.000000 EDL
        return await instance.runAction(TOKEN_CONTRACT, "transfer", {
          from: waxActor,
          to: GAME_CONTRACT,
          quantity,
          memo
        });
      },
      gameAction: async (name, data) => {
        return await instance.runAction(GAME_CONTRACT, name, data);
      },
      // low level
      runAction: async (account, name, data) => {
        // returns false on success
        if (!waxActor) {
          console.log("Wax actor is undefined");
          return "WaxJS not loaded";
        }
        const action = {
          account: account,
          name: name,
          authorization: [
            {
              actor: waxActor,
              permission: "active"
            }
          ],
          data: data
        };
        if (!waxWallet) {
          return "No login set";
        }
        if (waxWallet === "cloud") {
          var wax = instance.connectCloud();
          try {
            await wax.api.transact(
              {
                actions: [action]
              },
              {
                blocksBehind: 3,
                expireSeconds: 1200
              }
            );
            return false;
          } catch (e) {
            console.log(e);
            return e.toString();
          }
        } else {
          if (!_anchorSession) {
            return "No Anchor login set";
          }
          var result = await _anchorSession.transact({ action });
          const anchorResult =
            result.transaction &&
            result.transaction.id &&
            result.transaction.id.hexString
              ? false
              : "anchorerr";
          return anchorResult;
        }
      },
      // HELPER FUNCTIONS
      getAA: () => {
        if (!aaAPI) {
          var endpoint = isTest ? TESTNET_AA_ENDPOINT : MAINNET_AA_ENDPOINT;
          aaAPI = new atomicassets.ExplorerApi(endpoint, "atomicassets", {
            fetch
          });
        }
        return aaAPI;
      },
      connectCloud: (endpoint = null) => {
        if (endpoint === null) {
          endpoint = isTest ? TESTNET_ENDPOINT : MAINNET_ENDPOINT;
          if (!endpoint) {
            console.log("Endpoint does not exist");
            return null;
          }
        }

        if (!waxInstance) {
          waxInstance = new waxjs.WaxJS({
            rpcEndpoint: endpoint,
            tryAutoLogin: false
          });
        }

        return waxInstance;
      },
      connectAnchor: (endpoint = null) => {
        if (endpoint === null) {
          endpoint = isTest ? TESTNET_ENDPOINT : MAINNET_ENDPOINT;
          if (!endpoint) {
            console.log("Endpoint does not exist");
            return null;
          }
        }
        const transport = new AnchorLinkBrowserTransport();
        const link = new AnchorLink({
          transport,
          chains: [
            {
              chainId: isTest ? TEST_CHAIN_ID : MAINNET_CHAIN_ID,
              nodeUrl: endpoint
            }
          ]
        });
        return link;
      }
    };
  }

  return {
    getInstance: function(isTest = false) {
      if (!instance) {
        instance = createInstance(isTest);
      }
      return instance;
    }
  };
})();
