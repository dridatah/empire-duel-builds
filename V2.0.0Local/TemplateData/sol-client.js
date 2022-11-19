Buffer = Buffer.Buffer;

const TOKEN_DECIMALS = 1000000;

const DEPOSIT_SEED = "empiresduelsdeposit";

const ARGS_SCHEMAS = {
  deposit: {
    user: "pubkey",
    amount: "u64"
  },
  validation: {
    user: "pubkey",
    code: "u64"
  }
};

var EmpireSolClient = (function () {
  var instance;
  var provider;
  var userPublicKey = null;
  var connection = null;
  var metaplex = null;
  var templates = null;
  var assetsCache = [];

  const PROGRAM = new solanaWeb3.PublicKey(
    "CyyfmzuwCfSFkyz3ASkxdv1ikjPcKGGyTkoZeg3G8YLC"
  );
  const TOKEN = new solanaWeb3.PublicKey(
    "4rxhygepn3zBnDfV2XzjziAryDJgtCfk95MSLVLYi6FQ"
  ); // EDL actually...
  const TOKEN_ACCOUNT = new solanaWeb3.PublicKey(
    "92qWZbhp1jMJfKPkcaMzHm5x1XgiKnBNhiJwdbBAVxkb"
  );
  const GAME_ACCOUNT = new solanaWeb3.PublicKey(
    "Eu2zKbD1mAGMwg1wNQZJz8F13KwWTKEx3cZTwMUhDAXE"
  );
  const CONFIG_ACCOUNT = new solanaWeb3.PublicKey(
    "Ab9jHLrZrqNdouobkVxXjwCwQkDUPjuXhX23kMpeNEG2"
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
      setWallet: async address => {
        if (!provider) throw "Call init first";
        userPublicKey = new solanaWeb3.PublicKey(address);
        const resp = await provider.connect();
        if (address != resp.publicKey.toBase58()) {
          userPublicKey = null;
          provider.disconnect();
          return false;
        }
        return true;
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
        assetsCache = assetsCache.concat(
          result
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
            .filter(item => item !== null)
        );
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
      getPDA: async seeds => {
        let buffers = seeds.map(seed => {
          if (typeof seed === "string") {
            return Buffer.from(seed, "utf8");
          } else if (typeof seed === "number") {
            return Buffer.from([seed]);
          } else {
            return seed.toBuffer();
          }
        });
        return (await solanaWeb3.PublicKey.findProgramAddress(
          buffers,
          PROGRAM
        ))[0];
      },
      validateSolAddress: async uniqueCode => {
        let acc = await instance.getPDA([
          "soladdrrval",
          PROGRAM,
          userPublicKey
        ]);
        let connection = instance.createConnection();
        let trx = new solanaWeb3.Transaction();
        trx.add(
          instance.createInstruction(
            instance.convertToBytes(
              "validate",
              { user: userPublicKey, code: uniqueCode },
              ARGS_SCHEMAS.validation
            ),
            [acc, CONFIG_ACCOUNT],
            false
          )
        );
        try {
          let blockhash = (await connection.getLatestBlockhash("finalized"))
            .blockhash;
          trx.recentBlockhash = blockhash;
          trx.feePayer = userPublicKey;
          const { signature } = await provider.signAndSendTransaction(trx);
          return { isError: false, transactionID: signature };
        } catch (e) {
          console.error(e);
          return { isError: true, errorCode: e.code, errorMessage: e.message };
        }
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
          console.log("Asset", asset, assets[i], assetsCache);
          return;
          let fromAssocTokenAddress = await splToken.getAssociatedTokenAddress(
            asset.mintAddress,
            userPublicKey
          );

          let toAssocTokenAddress = await splToken.getAssociatedTokenAddress(
            asset.mintAddress,
            GAME_ACCOUNT,
            false
          );

          transaction.add(
            splToken.createAssociatedTokenAccountInstruction(
              userPublicKey, // payer
              toAssocTokenAddress, // ata
              GAME_ACCOUNT, // owner
              asset.mintAddress // mint
            )
          );

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
          // if (doSign) transaction.sign(newTokenAccount);
          const { signature } = await provider.signAndSendTransaction(
            transaction
          );
          return { isError: false, transactionID: signature };
        } catch (e) {
          console.error(e);
          return { isError: true, errorCode: e.code, errorMessage: e.message };
        }
      },
      createInstruction: (data, pad = [], useSystem = false) => {
        let keys = [
          { pubkey: userPublicKey, isSigner: true, isWritable: true }
        ];

        keys = keys.concat(
          pad.map(p => ({ pubkey: p, isSigner: false, isWritable: true }))
        );

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
      convertToBytes: (action, data, schema) => {
        var buf1 = Buffer.from(action);
        var buf0 = Buffer.from([buf1.length]);

        var bufs = [buf0, buf1];
        var bufsSize = buf0.length + buf1.length;

        var arr = Object.keys(data);
        for (var i = 0; i < arr.length; i++) {
          var k = arr[i];

          let sk = schema[k].constructor === Array ? schema[k][0] : schema[k];
          let sc = schema[k].constructor === Array ? schema[k][1] : 1;
          if (!data.hasOwnProperty(k)) continue;
          if (!data[k]) {
            console.error("Schema must have all keys, convertToBytes");
            return null;
          }

          let buf;

          switch (sk) {
            case "pubkey":
              if (sc === 1) {
                buf = new solanaWeb3.PublicKey(data[k]).toBuffer();
                bufs.push(buf);
                bufsSize += buf.length;
                if (buf.length !== 32) {
                  throw "Invalid SOL account address";
                }
              } else {
                for (let j = 0; j < sc; j++) {
                  buf = new solanaWeb3.PublicKey(data[k][j]).toBuffer();
                  bufs.push(buf);
                  bufsSize += buf.length;
                  if (buf.length !== 32) {
                    throw "Invalid SOL account address";
                  }
                }
              }
              break;
            case "u64":
              if (sc === 1) {
                if (isNaN(Number(data[k]))) {
                  throw "Invalid u64";
                }
                buf = Buffer.allocUnsafe(8);
                buf.writeBigUInt64BE(BigInt(data[k]), 0);
                bufs.push(buf);
                bufsSize += buf.length;
              } else {
                for (let j = 0; j < sc; j++) {
                  if (isNaN(Number(data[k][j]))) {
                    throw "Invalid u64";
                  }
                  buf = Buffer.allocUnsafe(8);
                  buf.writeBigUInt64BE(BigInt(data[k][j]), 0);
                  bufs.push(buf);
                  bufsSize += buf.length;
                }
              }
              break;
            case "u8":
              if (sc === 1) {
                if (isNaN(Number(data[k]))) {
                  throw "Invalid u8";
                }
                buf = Buffer.allocUnsafe(1);
                buf.writeUInt8(data[k], 0);
                bufs.push(buf);
                bufsSize += buf.length;
              } else {
                for (let j = 0; j < sc; j++) {
                  if (isNaN(Number(data[k][j]))) {
                    throw "Invalid u8";
                  }
                  buf = Buffer.allocUnsafe(1);
                  buf.writeUInt8(data[k][j], 0);
                  bufs.push(buf);
                  bufsSize += buf.length;
                }
              }

              break;
            case "i64":
              if (sc === 1) {
                if (isNaN(Number(data[k]))) {
                  throw "Invalid i64";
                }
                buf = Buffer.allocUnsafe(8);
                buf.writeBigInt64BE(BigInt(data[k]), 0);
                bufs.push(buf);
                bufsSize += buf.length;
              } else {
                for (let j = 0; j < sc; i++) {
                  if (isNaN(Number(data[k][j]))) {
                    throw "Invalid i64";
                  }
                  buf = Buffer.allocUnsafe(8);
                  buf.writeBigInt64BE(BigInt(data[k][j]), 0);
                  bufs.push(buf);
                  bufsSize += buf.length;
                }
              }
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
      },
      getAllAssets: async () => {
        var schemas = ["tools", "energy", "boosters"];
        var assets = [];
        for (let schemaId of schemas) {
          var items = await instance.getAssets(schemaId);
          assets.push(...items);
        }
        return assets;
      }
    };
  }

  return {
    getInstance: function (isTest = false) {
      if (!instance) {
        instance = createInstance(isTest);
      }
      return instance;
    }
  };
})();
