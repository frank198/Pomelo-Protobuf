'use strict';
const {loadSync} = require("protobufjs");

class ParseData
{
  constructor(filePath) {
    this.loadData(filePath);
  }

  loadData(filePath)
  {
    this.root = loadSync(filePath);
  }

  has(route)
  {
    if (!route || !this.root) return false;
    const awesomeMessage = this.root.lookup(route);
    return awesomeMessage != null;
  }

  encode(route, message)
  {
    const awesomeMessage = this.root.lookupTypeOrEnum(route);
    // Verify the payload if necessary (i.e. when possibly incomplete or invalid)
    const errMsg = awesomeMessage.verify(message);
    if (errMsg)
      throw Error(errMsg);

    // Create a new message
    const messageData = awesomeMessage.create(message); // or use .fromObject if conversion is necessary
    // Encode a message to an Uint8Array (browser) or Buffer (node)
    const buffer = awesomeMessage.encode(messageData).finish();
    return buffer;
  }

  decode(route, bytes)
  {
    const awesomeMessage = this.root.lookupTypeOrEnum(route);
    const message = awesomeMessage.decode(bytes);
    return message.toJSON();
  }
}

exports.compileSchema = function(bytesOrJson) {

  const root = loadSync(bytesOrJson);
  return {
    encode: (route, message) => {
      const awesomeMessage = root.lookupTypeOrEnum(route);
      // Verify the payload if necessary (i.e. when possibly incomplete or invalid)
      const errMsg = awesomeMessage.verify(message);
      if (errMsg)
        throw Error(errMsg);

      // Create a new message
      const messageData = awesomeMessage.create(message); // or use .fromObject if conversion is necessary
      // Encode a message to an Uint8Array (browser) or Buffer (node)
      const buffer = awesomeMessage.encode(messageData).finish();
      return buffer;
    },

    decode: (route, bytes) => {
      const awesomeMessage = root.lookupTypeOrEnum(route);
      const message = awesomeMessage.decode(bytes);
      return message.toJSON();
    },

    has:(route) =>{
      const AwesomeMessage = root.lookup(route);
      return AwesomeMessage != null;
    }
  };
};
