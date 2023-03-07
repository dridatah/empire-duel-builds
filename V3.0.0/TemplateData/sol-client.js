Buffer = Buffer.Buffer;

const TOKEN_DECIMALS = 1000000;

const DEPOSIT_SEED = "empiresduelsdeposit";

const PRODUCT_BRIDGE_USAGE = 1;

const ARGS_SCHEMAS = {
  deposit: {
    user: "pubkey",
    amount: "u64"
  },
  snbrdige: {
    owner: "pubkey",
    price: "u64",
    input: "pubkey",
    to: ["u8", 13]
  },
  snbrdige2: {
    owner: "pubkey",
    to: ["u8", 13]
  },
  stbridge: {
    owner: "pubkey",
    price: "u64",
    input: "u64",
    to: ["u8", 13]
  },
  stbridge2: {
    owner: "pubkey",
    to: ["u8", 13]
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
    "85kgTHaoCqo3zNqosQw5HaR1pBcJ3ecC1AYRp6vhPniQ"
  );

  const CONFIG_ACCOUNT = new solanaWeb3.PublicKey(
    "2YVVmpEjBrSqRisNDfKBmVseEFs2qn4nLvpV8kjk6SAF"
  );

  const BRIDGE_ACCOUNT = new solanaWeb3.PublicKey(
    "J4513NeEuheJ34hk41YFetYav4Hb2riC6FZgzXoD2VqX"
  );

  const TOKEN = new solanaWeb3.PublicKey(
    "DNAF3BjhfGcCYrzibuEqBRvCSbYydP8BWkvF42s2uBW3"
  );

  const TOKEN_ACCOUNT = new solanaWeb3.PublicKey(
    "4zQY2ptxEJJ9r7Z7TtXDAFJWwjzsQ2b1SULsddaW7SuB"
  );

  const GAME_ACCOUNT = new solanaWeb3.PublicKey(
    "8ftSBX6bWKUAZrB9KmvdvsZT42F9PkVaP12wgbTKeiFf"
  );

  const COLLECTION_ACCOUNT = new solanaWeb3.PublicKey(
    "CRRoz9nhYUsVwCxsx2pquyBgtY1NQji7QiCkaL6dUYRK"
  );

  const SOL_PROGRAM = new solanaWeb3.PublicKey(
    "9s3yZL1KJ1uwY1BF7iD3zKMfJ1qnnQTJDHRZys16NV4T"
  );

  const SOL_BALANCE_ACCOUNT = new solanaWeb3.PublicKey(
    "3zKuJKKDg9E2yyYTLPrZr3GapKWSrrzn93L9PAVhrF5v"
  );

  const MAINNET_ENDPOINT = "https://solana-mainnet.g.alchemy.com/v2/uh47isyuPGMOkYzq19F3P5q_difqzI_P";

  const DATA_SCHEMAS = {
    validation: {
      user: "pubkey",
      code: "u64",
      success: "u8"
    },
    perms: {
      initialized: "u8",
      owner: "pubkey",
      mode: "u8",
      to: ["u8", 13]
    },
    userBalance: {
      balance: "u64"
    },
    configs: {
      configs: ["u64", 15]
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
            isTest ? solanaWeb3.clusterApiUrl("devnet") : MAINNET_ENDPOINT,
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
        let assets = result
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

        assetsCache = assetsCache.concat(assets);
        return assets;
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
      getPAD: async (seeds, isSolProgram = false) => {
        let parsedSeeds = seeds.map(s => Buffer.from(s));
        return (await solanaWeb3.PublicKey.findProgramAddress(
          parsedSeeds,
          isSolProgram ? SOL_PROGRAM : PROGRAM
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
      convertToBytes: (action, data, schema) => {
        if (typeof action === "number") {
          var buf1 = Buffer.from([action]);
          var bufs = [buf1];
          var bufsSize = 1;
        } else {
          var buf1 = Buffer.from(action);
          var buf0 = Buffer.from([buf1.length]);
          var bufs = [buf0, buf1];
          var bufsSize = buf0.length + buf1.length;
        }

        var arr = Object.keys(data);

        for (var i = 0; i < arr.length; i++) {
          var k = arr[i];

          let sk = schema[k].constructor === Array ? schema[k][0] : schema[k];
          let sc = schema[k].constructor === Array ? schema[k][1] : 1;
          if (!data.hasOwnProperty(k)) continue;
          if (typeof data[k] === "undefined") {
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
                buf.writeBigUInt64LE(BigInt(data[k]), 0);
                bufs.push(buf);
                bufsSize += buf.length;
              } else {
                for (let j = 0; j < sc; j++) {
                  if (isNaN(Number(data[k][j]))) {
                    throw "Invalid u64";
                  }
                  buf = Buffer.allocUnsafe(8);
                  buf.writeBigUInt64LE(BigInt(data[k][j]), 0);
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
                buf.writeBigInt64LE(BigInt(data[k]), 0);
                bufs.push(buf);
                bufsSize += buf.length;
              } else {
                for (let j = 0; j < sc; i++) {
                  if (isNaN(Number(data[k][j]))) {
                    throw "Invalid i64";
                  }
                  buf = Buffer.allocUnsafe(8);
                  buf.writeBigInt64LE(BigInt(data[k][j]), 0);
                  bufs.push(buf);
                  bufsSize += buf.length;
                }
              }
              break;
          }
        }

        return Buffer.concat(bufs, bufsSize);
      },
      convertWAXAddress: str => {
        if (str.length > 13) {
          throw "Unexpected wax address";
        }
        let rv = [];
        for (var i = 0; i < 13; i++) rv.push(0);
        str.split("").forEach((c, i) => {
          rv[i] = c.charCodeAt(0);
        });
        return rv;
      },
      convertSeed: str => {
        let rv = [];
        str.split("").forEach((c, i) => {
          rv[i] = c.charCodeAt(0);
        });
        return rv;
      },
      getOrCreateProgramAccount: async (seeds, space, transaction) => {
        let seedsParsed = [];
        seeds.forEach(i => (seedsParsed = seedsParsed.concat(i)));
        seedsParsed = Uint8Array.from(seedsParsed);
        const conn = instance.createConnection();
        let address = solanaWeb3.Keypair.fromSeed(seedsParsed).publicKey;

        try {
          let accountInfo = await conn.getAccountInfo(address, "confirmed");
          if (accountInfo) return address;
        } catch (e) { }

        transaction.add(
          solanaWeb3.SystemProgram.createAccount({
            fromPubkey: userPublicKey,
            newAccountPubkey: address,
            space: space,
            lamports: await conn.getMinimumBalanceForRentExemption(space),
            programId: PROGRAM
          })
        );
        return address;
      },
      calculateSpace: schema => {
        var keys = Object.keys(schema);
        var bufsSize = 0;
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];

          if (!schema.hasOwnProperty(k)) continue;

          let buf;

          let sk = schema[k].constructor === Array ? schema[k][0] : schema[k];
          let sc = schema[k].constructor === Array ? schema[k][1] : 1;

          switch (sk) {
            case "pubkey":
              bufsSize += 32 * sc;
              break;
            case "i64":
            case "u64":
              bufsSize += 8 * sc;
              break;
            case "i32":
            case "u32":
              bufsSize += 4 * sc;
              break;
            case "i16":
            case "u16":
              bufsSize += 2 * sc;
              break;
            case "i8":
            case "u8":
              bufsSize += 1 * sc;
              break;
          }
        }

        return bufsSize;
      },
      bridgeNFT: async (asset, to) => {
        let config = await instance.getAccountData(CONFIG_ACCOUNT, "configs");

        var quantity = config.configs[1];

        var keys;
        var transaction = new solanaWeb3.Transaction();

        const account_owner = userPublicKey;
        const account_bridge_pda = await instance.getPAD([
          instance.convertSeed("brdigeempireduels"),
          instance.convertSeed("nbridge"),
          PROGRAM.toBytes(),
          userPublicKey.toBytes()
        ]);
        const account_permission_pda = await instance.getPAD([
          instance.convertSeed("permsempireduels"),
          PROGRAM.toBytes(),
          userPublicKey.toBytes()
        ]);
        const account_token_pda = BRIDGE_ACCOUNT;

        to = instance.convertWAXAddress(to);
        keys = [
          {
            pubkey: account_owner,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: account_bridge_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: account_permission_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: account_token_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: solanaWeb3.SystemProgram.programId,
            isSigner: false,
            isWritable: false
          }
        ];

        asset = instance.getAssetCache(asset);

        const snbridgeTri = new solanaWeb3.TransactionInstruction({
          keys,
          programId: PROGRAM,
          data: instance.convertToBytes(
            "snbridge",
            {
              owner: userPublicKey,
              price: quantity,
              input: asset.mintAddress,
              to: to
            },
            ARGS_SCHEMAS.snbrdige
          )
        });

        const solTransferTri = solanaWeb3.SystemProgram.transfer({
          fromPubkey: userPublicKey,
          lamports: quantity,
          toPubkey: account_token_pda
        });

        transaction.add(snbridgeTri, solTransferTri);

        let fromAssocTokenAddress = await splToken.getAssociatedTokenAddress(
          asset.mintAddress,
          userPublicKey
        );

        let toAssocTokenAddress = await splToken.getAssociatedTokenAddress(
          asset.mintAddress,
          account_token_pda,
          false
        );

        transaction.add(
          splToken.createAssociatedTokenAccountInstruction(
            userPublicKey, // payer
            toAssocTokenAddress, // ata
            account_token_pda, // owner
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

        keys = [
          {
            pubkey: account_owner,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: account_bridge_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: account_permission_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: account_token_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: CONFIG,
            isSigner: false,
            isWritable: false
          }
        ];

        const snbridge2Tri = new solanaWeb3.TransactionInstruction({
          keys,
          programId: PROGRAM,
          data: instance.convertToBytes(
            "snbridge2",
            {
              owner: userPublicKey,
              to: to
            },
            ARGS_SCHEMAS.snbrdige2
          )
        });
        // transaction = new solanaWeb3.Transaction();
        transaction.add(snbridge2Tri);
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
      getUserSOLDepositBalance: async () => {
        const user_balance_pda = await instance.getPAD(
          [
            userPublicKey.toBytes(),
            instance.convertSeed("soluser_balance"),
            SOL_PROGRAM.toBytes()
          ],
          true
        );

        let userBalance = await instance.getAccountData(
          user_balance_pda,
          "userBalance"
        );

        if (!userBalance) {
          return 0;
        } else {
          return userBalance.balance / 1000000000;
        }
      },
      transferSOL: async quantity => {
        var keys;
        var transaction = new solanaWeb3.Transaction();

        const signer_user = userPublicKey;
        const deposit_pda = await instance.getPAD(
          [
            userPublicKey.toBytes(),
            instance.convertSeed("soldeposit"),
            SOL_PROGRAM.toBytes()
          ],
          true
        );
        const product_pda = await instance.getPAD(
          [
            instance.convertSeed("" + PRODUCT_BRIDGE_USAGE),
            instance.convertSeed("soldeposit"),
            instance.convertSeed("product"),
            SOL_PROGRAM.toBytes()
          ],
          true
        );
        const balancer = SOL_BALANCE_ACCOUNT;
        const account_system = solanaWeb3.SystemProgram.programId;
        const user_balance_pda = await instance.getPAD(
          [
            userPublicKey.toBytes(),
            instance.convertSeed("soluser_balance"),
            SOL_PROGRAM.toBytes()
          ],
          true
        );

        keys = [
          {
            pubkey: signer_user,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: deposit_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: product_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: balancer,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: account_system,
            isSigner: false,
            isWritable: false
          }
        ];

        const initTri = new solanaWeb3.TransactionInstruction({
          keys,
          programId: SOL_PROGRAM,
          data: instance.convertToBytes(
            0,
            {
              owner: userPublicKey,
              product: PRODUCT_BRIDGE_USAGE,
              amount: quantity
            },
            {
              owner: "pubkey",
              product: "u64",
              amount: "u64"
            }
          )
        });

        const solTransferTri = solanaWeb3.SystemProgram.transfer({
          fromPubkey: userPublicKey,
          lamports: quantity,
          toPubkey: balancer
        });

        keys = [
          {
            pubkey: signer_user,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: deposit_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: user_balance_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: balancer,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: account_system,
            isSigner: false,
            isWritable: false
          }
        ];

        const depositTri = new solanaWeb3.TransactionInstruction({
          keys,
          programId: SOL_PROGRAM,
          data: instance.convertToBytes(
            1,
            {
              owner: userPublicKey
            },
            {
              owner: "pubkey"
            }
          )
        });

        transaction.add(initTri, solTransferTri, depositTri);
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
      withdrawSOL: async quantity => {
        var keys;
        var transaction = new solanaWeb3.Transaction();

        const signer_user = userPublicKey;
        const user_balance_pda = await instance.getPAD(
          [
            userPublicKey.toBytes(),
            instance.convertSeed("soluser_balance"),
            SOL_PROGRAM.toBytes()
          ],
          true
        );
        const balancer = SOL_BALANCE_ACCOUNT;
        const account_system = solanaWeb3.SystemProgram.programId;

        keys = [
          {
            pubkey: signer_user,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: user_balance_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: balancer,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: account_system,
            isSigner: false,
            isWritable: false
          }
        ];

        const initTri = new solanaWeb3.TransactionInstruction({
          keys,
          programId: SOL_PROGRAM,
          data: instance.convertToBytes(
            4,
            {
              owner: userPublicKey,
              amount: quantity
            },
            {
              owner: "pubkey",
              amount: "u64"
            }
          )
        });

        transaction.add(initTri);
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
      getBridgeTokenCost: async () => {
        let config = await instance.getAccountData(CONFIG_ACCOUNT, "configs");
        var quantity = config.configs[2];
        return quantity / 1000000000;
      },
      getBridgeNFTCost: async () => {
        let config = await instance.getAccountData(CONFIG_ACCOUNT, "configs");
        var quantity = config.configs[1];
        return quantity / 1000000000;
      },
      bridgeToken: async (amount, to) => {
        amount = Number(amount);
        let config = await instance.getAccountData(CONFIG_ACCOUNT, "configs");

        var quantity = config.configs[2];

        var keys;
        var transaction = new solanaWeb3.Transaction();

        const account_owner = userPublicKey;
        const account_bridge_pda = await instance.getPAD([
          instance.convertSeed("brdigeempireduels"),
          instance.convertSeed("tbridge"),
          PROGRAM.toBytes(),
          userPublicKey.toBytes()
        ]);
        const account_permission_pda = await instance.getPAD([
          instance.convertSeed("permsempireduels"),
          PROGRAM.toBytes(),
          userPublicKey.toBytes()
        ]);
        const account_token_pda = BRIDGE_ACCOUNT;

        to = instance.convertWAXAddress(to);
        keys = [
          {
            pubkey: account_owner,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: account_bridge_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: account_permission_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: account_token_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: solanaWeb3.SystemProgram.programId,
            isSigner: false,
            isWritable: false
          }
        ];

        const snbridgeTri = new solanaWeb3.TransactionInstruction({
          keys,
          programId: PROGRAM,
          data: instance.convertToBytes(
            "stbridge",
            {
              owner: userPublicKey,
              price: quantity,
              input: amount * TOKEN_DECIMALS,
              to: to
            },
            ARGS_SCHEMAS.stbridge
          )
        });

        const solTransferTri = solanaWeb3.SystemProgram.transfer({
          fromPubkey: userPublicKey,
          lamports: quantity,
          toPubkey: account_token_pda
        });

        transaction.add(snbridgeTri, solTransferTri);

        let fromAssocTokenAddress = await splToken.getAssociatedTokenAddress(
          TOKEN,
          userPublicKey
        );

        let toAssocTokenAddress = TOKEN_ACCOUNT;

        transaction.add(
          splToken.createTransferInstruction(
            fromAssocTokenAddress,
            toAssocTokenAddress,
            userPublicKey,
            amount * TOKEN_DECIMALS
          )
        );

        keys = [
          {
            pubkey: account_owner,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: account_bridge_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: account_permission_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: account_token_pda,
            isSigner: false,
            isWritable: false
          },
          {
            pubkey: CONFIG_ACCOUNT,
            isSigner: false,
            isWritable: false
          }
        ];

        const snbridge2Tri = new solanaWeb3.TransactionInstruction({
          keys,
          programId: PROGRAM,
          data: instance.convertToBytes(
            "stbridge2",
            {
              owner: userPublicKey,
              to: to
            },
            ARGS_SCHEMAS.stbridge2
          )
        });
        // transaction = new solanaWeb3.Transaction();
        transaction.add(snbridge2Tri);
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

          let toAssocTokenAddress = await splToken.getAssociatedTokenAddress(
            asset.mintAddress,
            GAME_ACCOUNT,
            false
          );

          try {
            let checkToAssocTokenAddress = await splToken.getAccount(
              connection,
              toAssocTokenAddress
            );
          } catch (e) {
            transaction.add(
              splToken.createAssociatedTokenAccountInstruction(
                userPublicKey, // payer
                toAssocTokenAddress, // ata
                GAME_ACCOUNT, // owner
                asset.mintAddress // mint
              )
            );
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
        console.log(transaction);
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
      stakeAssets: async (assets, postInstructions = []) => {
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

          let toAssocTokenAddress = await splToken.getAssociatedTokenAddress(
            asset.mintAddress,
            GAME_ACCOUNT,
            false
          );

          /*let account_owner = next_account_info(account_info_iter)?;
            let account_stake_pda = next_account_info(account_info_iter)?;
            let account_from = next_account_info(account_info_iter)?;
            let account_to = next_account_info(account_info_iter)?;
            let account_mint = next_account_info(account_info_iter)?;
            let account_spl = next_account_info(account_info_iter)?;
            let account_system = next_account_info(account_info_iter)?;*/

          let keys = [
            { pubkey: userPublicKey, isSigner: true, isWritable: true },
            {
              pubkey: await instance.getPDA([
                "stakesempireduels",
                PROGRAM,
                userPublicKey
              ]),
              isSigner: false,
              isWritable: true
            },
            {
              pubkey: fromAssocTokenAddress,
              isSigner: false,
              isWritable: true
            },
            { pubkey: toAssocTokenAddress, isSigner: false, isWritable: true },
            { pubkey: asset.mintAddress, isSigner: false, isWritable: true },
            {
              pubkey: splToken.TOKEN_PROGRAM_ID,
              isSigner: false,
              isWritable: false
            },
            {
              pubkey: solanaWeb3.SystemProgram.programId,
              isSigner: false,
              isWritable: false
            }
          ];

          try {
            await splToken.getAccount(connection, toAssocTokenAddress);
          } catch (e) {
            transaction.add(
              splToken.createAssociatedTokenAccountInstruction(
                userPublicKey, // payer
                toAssocTokenAddress, // ata
                GAME_ACCOUNT, // owner
                asset.mintAddress // mint
              )
            );
          }

          transaction.add(
            new solanaWeb3.TransactionInstruction({
              keys,
              programId: PROGRAM,
              data: instance.convertToBytes(
                "stake",
                {
                  index: i
                },
                {
                  index: "u8"
                }
              )
            })
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
      createStakeInstruction: async cards => {
        cards = [...cards];
        const owner_pda = await instance.getPDA([
          "stakesempireduels",
          PROGRAM,
          userPublicKey
        ]);
        keys = [
          {
            pubkey: userPublicKey,
            isSigner: true,
            isWritable: false
          },
          {
            pubkey: owner_pda,
            isSigner: false,
            isWritable: true
          },
          {
            pubkey: solanaWeb3.SystemProgram.programId,
            isSigner: false,
            isWritable: false
          }
        ];

        for (let i = cards.length; i < 5; i++) {
          cards.push(
            new solanaWeb3.PublicKey([
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0
            ])
          );
        }

        return new solanaWeb3.TransactionInstruction({
          keys,
          programId: PROGRAM,
          data: instance.convertToBytes(
            "stake",
            {
              owner: userPublicKey.toBase58(),
              mints: cards
            },
            {
              owner: "pubkey",
              mints: ["pubkey", 5]
            }
          )
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
              buf.writeBigUInt64LE(BigInt(data[k]), 0);
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
                rv[k] = setOrPush(rv[k], Number(data.readBigUInt64LE(ind)));
                ind += 8;
              }
              break;
            case "i64":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], Number(data.readBigInt64LE(ind)));
                ind += 8;
              }
              break;
            case "u32":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], data.readUInt32LE(ind));
                ind += 4;
              }
              break;
            case "u16":
              for (let j = 0; j < sc; j++) {
                rv[k] = setOrPush(rv[k], data.readUInt16LE(ind));
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
        var schemas = ["tools", "energy", "boosters", "chests", "sites"];
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
