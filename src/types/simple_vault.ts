/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/simple_vault.json`.
 */
export type SimpleVault = {
  "address": "6szSVnHy2GrCi6y7aQxJfQG9WpVkTgdB6kDXixepvdoW",
  "metadata": {
    "name": "simpleVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "closeVault",
      "discriminator": [
        141,
        103,
        17,
        126,
        72,
        75,
        29,
        29
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  51
                ]
              },
              {
                "kind": "account",
                "path": "assetMint"
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "assetMint"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "nftCollection",
          "docs": [
            "The NFT collection account (PDA from your NFT program)"
          ]
        },
        {
          "name": "userNftToken",
          "docs": [
            "✅ Must own at least 1 NFT where the mint authority is the collection"
          ]
        },
        {
          "name": "userNftMint"
        },
        {
          "name": "assetMint",
          "writable": true
        },
        {
          "name": "userAssetToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "assetMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "userSharePda",
          "docs": [
            "It's safe because: 1) Seeds are deterministic, 2) Only used as token account authority, 3) No data stored in this account"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  115,
                  104,
                  97,
                  114,
                  101,
                  115,
                  95,
                  118,
                  51
                ]
              },
              {
                "kind": "account",
                "path": "userNftMint"
              }
            ]
          }
        },
        {
          "name": "userShareToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "userSharePda"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "nftInfo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  105,
                  110,
                  102,
                  111,
                  95,
                  118,
                  51
                ]
              },
              {
                "kind": "account",
                "path": "userNftToken"
              },
              {
                "kind": "account",
                "path": "userShareToken"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeVault",
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "assetMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  118,
                  51
                ]
              },
              {
                "kind": "account",
                "path": "assetMint"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "assetMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nftCollectionAddress",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "nftCollection",
          "docs": [
            "The NFT collection account (PDA from your NFT program)"
          ]
        },
        {
          "name": "userNftToken",
          "docs": [
            "✅ Must own at least 1 NFT where the mint authority is the collection"
          ]
        },
        {
          "name": "userNftMint"
        },
        {
          "name": "assetMint",
          "writable": true
        },
        {
          "name": "userAssetToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "assetMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "userSharePda",
          "docs": [
            "It's safe because: 1) Seeds are deterministic, 2) Only used as token account authority, 3) No data stored in this account"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  115,
                  104,
                  97,
                  114,
                  101,
                  115,
                  95,
                  118,
                  51
                ]
              },
              {
                "kind": "account",
                "path": "userNftMint"
              }
            ]
          }
        },
        {
          "name": "userShareToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "userSharePda"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "nftInfo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  105,
                  110,
                  102,
                  111,
                  95,
                  118,
                  51
                ]
              },
              {
                "kind": "account",
                "path": "userNftToken"
              },
              {
                "kind": "account",
                "path": "userShareToken"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "collection",
      "discriminator": [
        48,
        160,
        232,
        205,
        191,
        207,
        26,
        141
      ]
    },
    {
      "name": "userInfo",
      "discriminator": [
        83,
        134,
        200,
        56,
        144,
        56,
        10,
        62
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "interestAccrued",
      "discriminator": [
        79,
        218,
        196,
        73,
        32,
        148,
        138,
        71
      ]
    },
    {
      "name": "withdrawEvent",
      "discriminator": [
        22,
        9,
        133,
        26,
        160,
        44,
        71,
        192
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Invalid deposit amount"
    },
    {
      "code": 6001,
      "name": "invalidNftCollection",
      "msg": "NFT does not belong to required collection"
    },
    {
      "code": 6002,
      "name": "insufficientShares",
      "msg": "Insufficent shares"
    },
    {
      "code": 6003,
      "name": "insufficientLiquidity",
      "msg": "Insufficent reserves"
    }
  ],
  "types": [
    {
      "name": "collection",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "baseUri",
            "type": "string"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "wormholeProgramId",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "uniqueIdToTokenId",
            "type": {
              "vec": {
                "defined": {
                  "name": "uniqueIdToTokenId"
                }
              }
            }
          },
          {
            "name": "tokenIdToUniqueId",
            "type": {
              "vec": {
                "defined": {
                  "name": "tokenIdToUniqueId"
                }
              }
            }
          },
          {
            "name": "mintToUniqueId",
            "type": {
              "vec": {
                "defined": {
                  "name": "mintToUniqueId"
                }
              }
            }
          },
          {
            "name": "crossChainUniqueIds",
            "type": {
              "vec": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "interestAccrued",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalInterest",
            "type": "u64"
          },
          {
            "name": "newIndex",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "mintToUniqueId",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "uniqueId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "tokenIdToUniqueId",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenId",
            "type": "u64"
          },
          {
            "name": "uniqueId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "uniqueIdToTokenId",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "uniqueId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tokenId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "nftMint",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "lastUpdate",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "assetMint",
            "type": "pubkey"
          },
          {
            "name": "shareMint",
            "type": "pubkey"
          },
          {
            "name": "nftCollectionAddress",
            "type": "pubkey"
          },
          {
            "name": "totalBorrowed",
            "type": "u64"
          },
          {
            "name": "borrowIndex",
            "type": "u64"
          },
          {
            "name": "borrowRate",
            "type": "u64"
          },
          {
            "name": "lastUpdateTime",
            "type": "i64"
          },
          {
            "name": "reserveFactor",
            "type": "u64"
          },
          {
            "name": "totalReserves",
            "type": "u64"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "withdrawEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
