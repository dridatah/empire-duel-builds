Buffer = Buffer.Buffer;

const TOKEN_DECIMALS = 1000000;

const DEPOSIT_SEED = "empiresduelsdeposit";

const ARGS_SCHEMAS = {
  deposit: {
    user: "pubkey",
    amount: "u64"
  }
};

var EmpireSolClient = (function() {
  var instance;
  var provider;
  var userPublicKey = null;
  var connection = null;
  var metaplex = null;
  var templates = null;
  var assetsCache = [];

  const PROGRAM = new solanaWeb3.PublicKey(
    "6A9mRBWJhxBgN6zDBFqZUpigsbKZ4UU44QgCbx4vYr35"
  );
  const TOKEN = new solanaWeb3.PublicKey(
    "4rxhygepn3zBnDfV2XzjziAryDJgtCfk95MSLVLYi6FQ"
  );
  const TOKEN_ACCOUNT = new solanaWeb3.PublicKey(
    "92qWZbhp1jMJfKPkcaMzHm5x1XgiKnBNhiJwdbBAVxkb"
  );
  const GAME_ACCOUNT = new solanaWeb3.PublicKey(
    "Eu2zKbD1mAGMwg1wNQZJz8F13KwWTKEx3cZTwMUhDAXE"
  );
  const MAINNET_ENDPOINT = "";

  const DATA_SCHEMAS = {
    validation: {
      user: "pubkey",
      code: "u64",
      success: "u8"
    }
  };

  function createInstance(isTest) {
    return {
      init: async () => {
        templates = await (await fetch(
          "sol-metadata.json?r=" + Math.floor(Math.random() * 1000000)
        )).json();
        provider = instance.getPhantom();
        if (!provider) return { phantom: false, publicKey: null };
        return { phantom: true, provider: provider.publicKey };
      },
      getPhantom: () => {
        let obj = window.phantom;
        if (!obj) return null;
        obj = obj.solana;
        if (!obj) return null;
        if (!obj.isPhantom) return null;
        return window.phantom.solana;
      },
      connect: async () => {
        try {
          if (!provider) throw "Call init first";
          const resp = await provider.connect();
          userPublicKey = resp.publicKey;
          return userPublicKey.toString();
        } catch (err) {
          console.error(err);
          return null;
        }
      },
      createConnection: () => {
        if (!connection) {
          connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl(isTest ? "devnet" : MAINNET_ENDPOINT),
            "confirmed"
          );
        }
        return connection;
      },
      getTokenBalance: async () => {
        let result = await instance
          .createConnection()
          .getTokenAccountsByOwner(userPublicKey, { mint: TOKEN });
        if (result.value && result.value[0] && result.value[0].account) {
          let amount = Number(
            splToken.AccountLayout.decode(result.value[0].account.data).amount
          );
          return amount / TOKEN_DECIMALS;
        } else {
          return 0;
        }
      },
      getMetaplex: (childKey = "nfts") => {
        if (!metaplex) {
          let conn = instance.createConnection();
          metaplex = new Metaplex(conn);
        }
        return metaplex[childKey]();
      },
      getAssetCache: address => {
        return assetsCache.find(item => item.address.toBase58() === address);
      },
      getAssets: async (schema = null) => {
        let mp = instance.getMetaplex();
        let result = await mp.findAllByOwner({ owner: userPublicKey });
        assetsCache = result
          .map(item => {
            let template = instance.getTemplate(instance.getKey(item.uri));
            if (!template) return null;
            if (schema && template.type !== schema) return null;
            return {
              templateId: template.templateId,
              address: item.address,
              mintAddress: item.mintAddress
            };
          })
          .filter(item => item !== null);
        return assetsCache;
      },
      getKey: v => {
        let arr = v.split("/");
        return arr[arr.length - 1].split(".json")[0];
      },
      getTemplate: key => {
        if (templates[key]) return templates[key];
      },
      getUserPublicKey: () => userPublicKey,
      getSchema: key => DATA_SCHEMAS[key],
      getAccountData: async (pubKey, schemaName) => {
        let accountInfo = await instance
          .createConnection()
          .getAccountInfo(pubKey, "confirmed");
        if (!accountInfo) return null;
        return instance.parseAccountData(
          accountInfo.data,
          instance.getSchema(schemaName)
        );
      },
      getPAD: async (seed, address = null) => {
        if (!address) address = userPublicKey;
        let addrBuf = userPublicKey.toBuffer();
        let seedBuf = Buffer.from(seed, "utf8");
        return (await PublicKey.findProgramAddress(
          [addrBuf, seedBuf],
          PROGRAM
        ))[0];
      },
      transferTokenToGame: async (amount, postInstructions = []) => {
        return instance.transferToken(TOKEN_ACCOUNT, amount, postInstructions);
      },
      transferToken: async (to, amount, postInstructions = []) => {
        if (!provider) {
          throw "err1";
        }
        let connection = instance.createConnection();
        let fromTokenAddress = await splToken.getAssociatedTokenAddress(
          TOKEN,
          userPublicKey
        );
        const transaction = new solanaWeb3.Transaction();
        transaction.add(
          splToken.createTransferInstruction(
            fromTokenAddress,
            to,
            userPublicKey,
            amount * TOKEN_DECIMALS
          )
        );
        postInstructions.forEach(ti => transaction.add(ti));
        try {
          let blockhash = (await connection.getLatestBlockhash("finalized"))
            .blockhash;
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = userPublicKey;
          const { signature } = await provider.signAndSendTransaction(
            transaction
          );
          return { isError: false, transactionID: signature };
        } catch (e) {
          console.error(e);
          return { isError: true, errorCode: e.code, errorMessage: e.message };
        }
      },
      transferAssets: async (assets, postInstructions = []) => {
        if (!provider) {
          throw "err1";
        }
        let connection = instance.createConnection();
        const transaction = new solanaWeb3.Transaction();

        for (let i = 0; i < assets.length; i++) {
          let asset = instance.getAssetCache(assets[i]);

          let fromAssocTokenAddress = await splToken.getAssociatedTokenAddress(
            asset.mintAddress,
            userPublicKey
          );

          let tryToAssocTokenAddress = await splToken.getAssociatedTokenAddress(
            asset.mintAddress,
            GAME_ACCOUNT
          );

          let toAssocTokenAddress;
          var newTokenAccount = solanaWeb3.Keypair.generate();
          var doSign = false;
          try {
            let checkToAssocTokenAddress = await splToken.getAccount(
              connection,
              tryToAssocTokenAddress
            );
            toAssocTokenAddress = checkToAssocTokenAddress.address;
          } catch (e) {
            transaction.add(
              solanaWeb3.SystemProgram.createAccount({
                fromPubkey: userPublicKey,
                newAccountPubkey: newTokenAccount.publicKey,
                space: splToken.ACCOUNT_SIZE,
                lamports: await splToken.getMinimumBalanceForRentExemptAccount(
                  connection
                ),
                programId: splToken.TOKEN_PROGRAM_ID
              }),
              // init token account
              splToken.createInitializeAccountInstruction(
                newTokenAccount.publicKey,
                asset.mintAddress,
                GAME_ACCOUNT
              )
            );
            doSign = true;
            toAssocTokenAddress = newTokenAccount.publicKey;
          }

          transaction.add(
            splToken.createTransferCheckedInstruction(
              fromAssocTokenAddress,
              asset.mintAddress,
              toAssocTokenAddress,
              userPublicKey,
              1,
              0
            )
          );
        }

        postInstructions.forEach(ti => transaction.add(ti));
        try {
          let blockhash = await connection.getLatestBlockhash("finalized");
          blockhash = blockhash.blockhash;
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = userPublicKey;
          if (doSign) transaction.sign(newTokenAccount);
          const { signature } = await provider.signAndSendTransaction(
            transaction
          );
          return { isError: false, transactionID: signature };
        } catch (e) {
          console.error(e);
          return { isError: true, errorCode: e.code, errorMessage: e.message };
        }
      },
      createInstruction: (data, pad = null, useSystem = false) => {
        let keys = pad
          ? [
              {
                pubkey: userPublicKey,
                isSigner: true,
                isWritable: true
              },
              { pubkey: pad, isSigner: false, isWritable: true }
            ]
          : [{ pubkey: userPublicKey, isSigner: true, isWritable: true }];

        if (useSystem) {
          keys.push({
            pubkey: solanaWeb3.SystemProgram.programId,
            isSigner: false,
            isWritable: false
          });
        }

        return new solanaWeb3.TransactionInstruction({
          keys,
          programId: PROGRAM,
          data
        });
      },
      createAction: (action, data, schema) => {
        var buf1 = Buffer.from(action);
        var buf0 = Buffer.from([buf1.length]);

        var bufs = [buf0, buf1];
        var bufsSize = buf0.length + buf1.length;

        var arr = Object.keys(data);
        for (var i = 0; i < arr.length; i++) {
          var k = arr[i];

          if (!data.hasOwnProperty(k)) continue;

          if (!schema[k]) {
            console.error("Schema must have all keys, convertToBytes");
            return null;
          }

          let buf;

          switch (schema[k]) {
            case "pubkey":
              buf = data[k].toBuffer();
              bufs.push(buf);
              bufsSize += buf.length;
              if (buf.length !== 32) {
                throw "Invalid SOL account address";
              }
              break;
            case "u64":
              if (isNaN(Number(data[k]))) {
                throw "Invalid u64";
              }
              buf = Buffer.allocUnsafe(8);
              buf.writeBigUInt64BE(BigInt(data[k]), 0);
              bufs.push(buf);
              bufsSize += buf.length;
              break;
          }
        }

        return Buffer.concat(bufs, bufsSize);
      },
      parseAccountData: (data, schema) => {
        var keys = Object.keys(schema);
        var rv = {};
        var ind = 0;

        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];

          if (!schema.hasOwnProperty(k)) continue;

          let sk = schema[k].constructor === Array ? schema[k][0] : schema[k];
          let sc = schema[k].constructor === Array ? schema[k][1] : 1;

          if (sc > 1) {
            rv[k] = [];
          }

          const setOrPush = (cont, val) => {
            if (cont && cont.constructor === Array) {
              cont.push(val);
              return cont;
            }
            return val;
          };

          switch (sk) {
            case "pubkey":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(
                  rv[k],
                  new PublicKey(data.slice(ind, ind + 32)).toBase58()
                );
                ind += 32;
              }
              break;
            case "u64":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], Number(data.readBigUInt64BE(ind)));
                ind += 8;
              }
              break;
            case "i64":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], Number(data.readBigInt64BE(ind)));
                ind += 8;
              }
              break;
            case "u32":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], data.readUInt32BE(ind));
                ind += 4;
              }
              break;
            case "u16":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], data.readUInt16BE(ind));
                ind += 2;
              }
              break;
            case "u8":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], data.readInt8(ind));
                ind += 1;
              }
              break;
          }
        }

        return rv;
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
