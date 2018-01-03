/**
 * Created by dido on 31.01.17.
 * Holds crypto methods
 */
'use strict';
(function(exports) {

    var isIE11 = typeof window!== 'undefined' &&!!navigator.userAgent.match(/Trident.*rv\:11\./);
const PUBLIC_KEY = "PUBLIC_KEY_";
const PRIVATE_KEY="PRIVATE_KEY_";
const EMAIL="EMAIL";
const A="A";
/**
 * Converts string to typedarray
 * @param str - string
 */
function convertStringToArrayBufferView(str) {
  let buffer = new StringView(str,"UTF-8").bufferView;
  return buffer;
}
/**
 * Concatenates two typedarrays
 * @param a
 * @param b
 * @returns {*}
 */
function concatTypedArrays(a, b) { // a, b TypedArray of same type
  let c = new (a.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}
/**
 * Converts arraybuffer (UTF-8) to string
 * @param buffer
 * @returns {string}
 */
function convertArrayBufferViewtoString(buffer,encoding) {
    let str;
  if (encoding==undefined) {
      str = new StringView(buffer, "UTF-8");
  } else {
      str = new StringView(buffer, "UTF-8");
  }
    return str.toString();
}
    /**
     * Generate SHA 512 byteArray
     * @param passwordString
     */
    function sha512(passwordString) {
        let buffer = new StringView(passwordString,"UTF-8");
        console.log(buffer);
        console.log(crypto.subtle.digest("SHA-512", buffer.bufferView));
        return crypto.subtle.digest("SHA-512", buffer.bufferView);
    }
    /**
     * Generate SHA512 string
     * @param passwordString
     * @returns {Promise} hashed string
     */
    function sha512hex(passwordString) {
        return new Promise(function (resolve, reject) {
            sha512(passwordString).then(function (hash) {
                resolve(hex(hash));
            });
        })
    }
/**
 * Generate SHA256 ByteArray
 * @param passwordString
 */
function sha256(passwordString) {
  let buffer = new StringView(passwordString,"UTF-8");
  return crypto.subtle.digest("SHA-256", buffer.bufferView).catch(internalErrorInCrypto);
}

/**
 * Generate SHA256 string
 * @param passwordString
 * @returns {Promise} hashed string
 */
function sha256hex(passwordString) {
  return new Promise(function (resolve, reject) {
    sha256(passwordString).then(function (hash) {
      resolve(hex(hash));
    });
  }).catch(internalErrorInCrypto);
}


/**
 * Generates string hex from typedarray
 * @param buffer
 * @returns {string}
 */
function hex(buffer) {
  let hexCodes = [];
  let view = new DataView(buffer);
  for (let i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    let value = view.getUint32(i);
    // toString(16) will give the hex representation of the number without padding
    let stringValue = value.toString(16);
    // We use concatenation and slice for padding
    let padding = '00000000';
    let paddedValue = (padding + stringValue).slice(-padding.length);
    hexCodes.push(paddedValue);
  }
  // Join all the hex strings into one
  return hexCodes.join("");
}
/**
 * Generates AES key
 */
function generateAESKey() {
  return crypto.subtle.generateKey({
    name: "AES-CBC",
    length: 256
  }, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']).catch(internalErrorInCrypto);
}
/**
 * Generates AES key from sha-256 of password
 * @param password - String password
 */
function generateAESKeyFromPassword(password) {
  return sha256(convertStringToArrayBufferView(password)).then(function (result) {
    return sha256(result).then(function (doubleSha) {
      return window.crypto.subtle.importKey("raw", doubleSha, {name: "AES-CBC"}, true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
    });

  });
}

/**
 * Import Key in JWK
 * @param key - aes key
 * @returns {Promise} imported key in CryptoKey format
 */
function importAESKey(key) {
  return window.crypto.subtle.importKey("jwk", key, {name: "AES-CBC"}, true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]).catch(internalErrorInCrypto);
}

function importRAWAESKey(key) {
  return window.crypto.subtle.importKey("raw", key, {name: "AES-CBC"}, true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]).catch(internalErrorInCrypto);
}


/**
 * Encrypts data with aes key
 * @param key - aes key in CryptoKey
 * @param data - byte array
 * @returns {Promise} (encrypted byte array)
 */
function encryptData(key, data) {
  return new Promise(function (resolve, reject) {
    let vector = crypto.getRandomValues(new Uint8Array(16));
    crypto.subtle.encrypt({name: "AES-CBC", iv: vector}, key, data).then(
        function (result) {
          let encrypted_data = new Uint8Array(result);
          // add IV to array
          encrypted_data = concatTypedArrays(vector, encrypted_data);

          resolve(encrypted_data);
        },
        function (e) {
          console.log(e.message);
          reject(e);
        }
    );
  })
}

/**
 * Generate Public/Private key pair.
 * @returns {Promise} PKI object with two CryptoKey keys - public and private
 */
function generatePKI() {
  return window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),  // 24 bit representation of 65537
        hash: {name: "SHA-512"}
      }, true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  ).catch(internalErrorInCrypto);

}
/**
 * Wrapper function to store something in the local storage
 * @param key - string key
 * @param value - string value
 */
function storeInLocalStorage(key, value) {
  localStorage.setItem(key, value);
}

  function getFromLocalStorage(key) {
    return localStorage.getItem(key);
  }

/**
 * Wrapper function to get something from the local storage
 * @param key - string key
 */
function getKeyFromLocalStorage(key) {
  return localStorage.getItem(key);
}


/**
 * Function that returns the base64 from a key
 * @param exportedKey key in jwk format
 * @returns {string} base64
 */
function getBase64FromExportedKey(exportedKey) {
  return new StringView(convertStringToArrayBufferView(JSON.stringify(exportedKey))).toBase64();
}
/**
 * Function that returns the jwk key from base64 string
 * @param base64Str - string
 */
function getKeyFromBase64(base64Str) {
  return JSON.stringify(JSON.parse(StringView.makeFromBase64(base64Str).toString()));
}
/**
 * Import private key in jwk format
 * @param key - private key in arrayBuffer format
 * @returns {Promise} - Private key in CryptoKey object
 */
function importPrivateKey(key) {
  return window.crypto.subtle.importKey(
      "jwk",
      key,
      {   //these are the algorithm options
        name: "RSA-OAEP",
        hash: {name: "SHA-512"},
      },
      true, //whether the key is extractable (i.e. can be used in exportKey)
      ["decrypt", "unwrapKey"] //"encrypt" or "wrapKey" for public key import or
      //"decrypt" or "unwrapKey" for private key imports
  ).catch(internalErrorInCrypto);
}
/**
 * Import public key in jwk format
 * @param key - pubic key in arrayBuffer format
 * @returns {Promise} - Public key in CryptoKey object
 */
function importPublicKey(key) {
  return window.crypto.subtle.importKey(
      "jwk",
      key,
      {   //these are the algorithm options
        name: "RSA-OAEP",
        hash: {name: "SHA-512"},
      },
      true, //whether the key is extractable (i.e. can be used in exportKey)
      ["encrypt", "wrapKey"] //"encrypt" or "wrapKey" for public key import or
      //"decrypt" or "unwrapKey" for private key imports
  ).catch(internalErrorInCrypto);
}
/**
 * Export key
 * @param key - key in CryptoKey format
 * @returns {Promise} - the key jwk format
 */
function exportKey(key) {
  return window.crypto.subtle.exportKey(
      "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
      key //can be a publicKey or privateKey, as long as extractable was true
  ).catch(internalErrorInCrypto);
}
/**
 * Export key
 * @param key - key in CryptoKey format
 * @returns {Promise} - the key raw format
 */
function exportRawKey(key) {
  return window.crypto.subtle.exportKey(
      "raw", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
      key //can be a publicKey or privateKey, as long as extractable was true
  ).catch(internalErrorInCrypto);
}

/**
 * Decrypt data with AES key
 * @param key - AES key in CryptoKey format
 * @param data - data in ByteArray format
 * @returns {Promise} decrypted data in byteArray
 */
function decryptData(key, data) {

  let vector = data.slice(0, 16);
  let data2 = data.slice(16);
  return crypto.subtle.decrypt({name: "AES-CBC", iv: vector}, key, data2).catch(internalErrorInCrypto);
}
/**
 * Wrap AES key for transportation and storage
 * @param aesKey - aes key in CryptoKey format
 * @param publicKey - public key in CryptoKey format
 * @returns {Promise} wrapped aes key in raw format
 */
function wrapAESKey(aesKey, publicKey) {
  return crypto.subtle.wrapKey("jwk", aesKey, publicKey, {name: "RSA-OAEP", hash: "SHA-256"});
}
/**
 * Wrap AES key for transportation and storage
 * @param aesKey - aes key in CryptoKey format
 * @param publicKey - public key in CryptoKey format
 * @returns {Promise} wrapped aes key in jwk format
 */
function wrapAESKeyJWK(aesKey, publicKey) {
  return crypto.subtle.wrapKey("jwk", aesKey, publicKey, {name: "RSA-OAEP", hash: "SHA-256"}).catch(internalErrorInCrypto);
}


/**
 * Unwrap AES key for usage with encrypt/decrypt
 * @param wrappedKey - wrapped AES in CryptoKey format
 * @param privateKey - Private key in CryptoKey format
 * @returns {Promise} unwrapped AES in raw format
 */
function unwrapAESKey(wrapedKey,privateKey) {
    return crypto.subtle.unwrapKey("jwk",wrapedKey,privateKey,{ name:"RSA-OAEP",hash:"SHA-256"},{name:"AES-CBC",length:256,hash:"SHA-256"},true,["encrypt","decrypt","wrapKey","unwrapKey"]).catch(internalErrorInCrypto);

}


function storePublicInLocalStorage (key) {


  return exportKey(key).then(function (ex) {
     localStorage.setItem(PUBLIC_KEY + localStorage.getItem(EMAIL),JSON.stringify(ex));
     return getPublicFromLocalStorage();
  });

}

    /**
     * Add aes key to session storage
     * @param password
     * @returns {Promise}
     */
    function addAesToSessionStorage(password) {
   return new Promise(function (resolve,reject) {
       generateAESKeyFromPassword(password).then(function (result) {
           return exportKey(result).then(function (exportAes) {
               sessionStorage.setItem(A,JSON.stringify(exportAes));
               resolve();
           })
       })
   })

}

  function addAesToLocalStorage(password) {
    return new Promise(function (resolve,reject) {
      generateAESKeyFromPassword(password).then(function (result) {
        return exportKey(result).then(function (exportAes) {
          localStorage.setItem(A,JSON.stringify(exportAes));
          resolve();
        })
      })
    })

  }

function storePrivateInLocalStorage (key,password) {

  return generateAESKeyFromPassword(password).then(function (result) {
   return exportKey(result).then(function (exportAes) {
      sessionStorage.setItem(A,JSON.stringify(exportAes));
      return exportKey(key).then(function (ex) {
        return encryptData(result,convertStringToArrayBufferView(JSON.stringify(ex))).then(function (encryptData) {
          localStorage.setItem(PRIVATE_KEY + localStorage.getItem(EMAIL),new StringView(encryptData).toBase64());
          return localStorage.getItem(PRIVATE_KEY + localStorage.getItem(EMAIL));
        }).catch(internalErrorInCrypto);
      }).catch(internalErrorInCrypto);
    }).catch(internalErrorInCrypto);

  })
}

function internalErrorInCrypto(e) {
    console.log("ERROR IN CRYPTO");
    console.log(e);
}

function getPublicFromLocalStorage () {



  return importPublicKey(JSON.parse(localStorage.getItem(PUBLIC_KEY + localStorage.getItem(EMAIL))));
}

  function getPrivateFromLocalStorage () {

      return new Promise(function (resolve,reject) {
        try {
          let privateKey = StringView.makeFromBase64(localStorage.getItem(PRIVATE_KEY + localStorage.getItem(EMAIL))).bufferView;
          importAESKey(JSON.parse(sessionStorage.getItem(A))|| JSON.parse(localStorage.getItem(A))).then(function (cryptoAes) {
            decryptData(cryptoAes,privateKey).then(function (decryptData) {
              importPrivateKey(JSON.parse(convertArrayBufferViewtoString(decryptData))).then(function (cryptoPrivate) {
                resolve(cryptoPrivate);
              });
            });
          });
        } catch (err){
          console.log(err);
          resolve(null);
        }
      });

  }

function getPrivateFromLocalStorageAsJSON () {

    let privateKey = StringView.makeFromBase64(localStorage.getItem(PRIVATE_KEY + localStorage.getItem(EMAIL))).bufferView;
    return importAESKey(JSON.parse(sessionStorage.getItem(A))).then(function (cryptoAes) {
        return decryptData(cryptoAes,privateKey).then(function (decryptData) {
           return  JSON.parse(convertArrayBufferViewtoString(decryptData));
        }).catch(function (e) {
            console.log(e);
        })
    });
}

function encryptWithPKI (publicKey,data) {
  return window.crypto.subtle.encrypt(
    {
      'name': "RSA-OAEP"
      //label: Uint8Array([...]) //optional
    },
    publicKey, //from generateKey or importKey above
    data //ArrayBuffer of data you want to encrypt
  )
}

function decryptWithPKI(privateKey,data){
 return window.crypto.subtle.decrypt(
    {
      'name': "RSA-OAEP"
    },
    privateKey, //from generateKey or importKey above
    data //ArrayBuffer of the data
  )
}

  function clearStorage () {
    localStorage.clear();
    sessionStorage.clear();
  }

  function storeImportPrivateInLocalStorage(privateKey){
    localStorage.setItem(PRIVATE_KEY + localStorage.getItem(EMAIL),privateKey);
  }

exports.generateAESKey = generateAESKey;
exports.encryptData = encryptData;
exports.decryptData = decryptData;
exports.sha512 = sha512;
exports.sha512hex = sha512hex;
exports.sha256 = sha256;
exports.sha256hex = sha256hex;
exports.generatePKI = generatePKI;
exports.exportKey = exportKey;
exports.importPrivateKey = importPrivateKey;
exports.importPublicKey = importPublicKey;
exports.importAESKey = importAESKey;
exports.wrapAESKey = wrapAESKey;
exports.unwrapAESKey = unwrapAESKey;
exports.storeInLocalStorage = storeInLocalStorage;
exports.convertStringToArrayBufferView = convertStringToArrayBufferView;
exports.convertArrayBufferViewtoString = convertArrayBufferViewtoString;
exports.PUBLIC_KEY = PUBLIC_KEY;
exports.PRIVATE_KEY = PRIVATE_KEY;
exports.EMAIL = EMAIL;
exports.A = A;
exports.getKeyFromLocalStorage = getKeyFromLocalStorage;
exports.getBase64FromExportedKey = getBase64FromExportedKey;
exports.getKeyFromBase64 = getKeyFromBase64;
exports.exportRawKey = exportRawKey;
exports.wrapAESKeyJWK = wrapAESKeyJWK;
exports.storePublicInLocalStorage=storePublicInLocalStorage;
exports.storePrivateInLocalStorage=storePrivateInLocalStorage;
exports.generateAESKeyFromPassword=generateAESKeyFromPassword;
exports.getPublicFromLocalStorage=getPublicFromLocalStorage;
exports.getPrivateFromLocalStorage=getPrivateFromLocalStorage;
exports.encryptWithPKI=encryptWithPKI;
exports.decryptWithPKI=decryptWithPKI;
exports.importRAWAESKey=importRAWAESKey;
exports.getPrivateFromLocalStorageAsJSON=getPrivateFromLocalStorageAsJSON;
exports.addAesToSessionStorage=addAesToSessionStorage;
exports.addAesToLocalStorage=addAesToLocalStorage;
exports.getFromLocalStorage=getFromLocalStorage;
exports.clearStorage=clearStorage;
exports.storeImportPrivateInLocalStorage=storeImportPrivateInLocalStorage;

})(typeof exports === 'undefined' ? this['Crypto']={}:exports);

