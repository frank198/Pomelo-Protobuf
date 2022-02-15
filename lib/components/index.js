'use strict';
const SERVER = 'server';
const CLIENT = 'client';
const ServerRouteDic = 'serverRouteDic';
const ClientRouteDic = 'clientRouteDic';
const ServerMessageData = 'serverFBData';
const ClientMessageData = 'clientFBData';
const parseData = require('../ParseData');
const fs = require('fs');
const path = require('path');
const watchers = Symbol('watchers');
const publicKey = Symbol('publicKey');
const serverProtoBuffer = Symbol('serverProtoBuffer');
const clientProtoBuffer = Symbol('clientFlatBuffer');

class Index
{
  constructor(app, opts)
  {
    this.app = app;
    this.version = 0;
    this[watchers] = new Map();
    this.serverRouteDicObject = this.clientRouteDicObject = {};
    opts = opts || {};
    this.serverProtoJsonPath = opts.serverProtos || '/config/serverProtos.json';
    this.clientProtoJsonPath = opts.clientProtos || '/config/clientProtos.json';
    this.serverRouteDicPath = opts.serverRouteDic || '/config/serverRouteRelationship.json';
    this.clientRouteDicPath = opts.clientRouteDic || '/config/clientRouteRelationship.json';
    this.serverProtoPath = opts.serverMessagePath || '/config/protoFile/serverProto.proto';
    this.clientProtoPath = opts.clientMessagePath || '/config/protoFile/clientProto.proto';
    this.logger = opts.logger || console;
    this[publicKey] = opts.publicKey || '';
  }

  start(cb)
  {
    this.setProtos(SERVER, path.join(this.app.getBase(), this.serverProtoJsonPath));
    this.setProtos(CLIENT, path.join(this.app.getBase(), this.clientProtoJsonPath));
    this.setProtos(ServerRouteDic, path.join(this.app.getBase(), this.serverRouteDicPath));
    this.setProtos(ClientRouteDic, path.join(this.app.getBase(), this.clientRouteDicPath));
    this.setProtos(ServerMessageData, path.join(this.app.getBase(), this.serverProtoPath));
    this.setProtos(ClientMessageData, path.join(this.app.getBase(), this.clientProtoPath));
    process.nextTick(cb);
  }

  check(type, route)
  {
    let curRoute = route;
    let hasInstance = null;
    switch (type) {
      case SERVER:
        curRoute = this.serverRouteDicObject[route] || route;
        hasInstance = this[serverProtoBuffer].has(curRoute);
        break;
      case CLIENT:
        curRoute = this.clientRouteDicObject[route] || route;
        hasInstance = this[clientProtoBuffer].has(curRoute);
        break;
      default:
        throw new Error('decodeIO meet with error type of protos, type: ' + type + ' route: ' + route);
    }
    return hasInstance;
  }

  encode(route, message)
  {
    let curRoute = this.serverRouteDicObject[route] || route;
    return this[serverProtoBuffer].encode(curRoute, message);
  }

  decode(route, message)
  {
    let curRoute = this.clientRouteDicObject[route] || route;
    return this[clientProtoBuffer].decode(curRoute, message);
  }

  getProtos()
  {
    return {
      server    : this.serverProtos,
      client    : this.clientProtos,
      publicKey : this[publicKey],
      version   : this.version
    };
  }

  getVersion()
  {
    return this.version;
  }

  setProtos(type, filePath)
  {
    if (!fs.existsSync(filePath))
    {
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.isFile())
    {
      const baseName = path.basename(filePath);
      if (type === SERVER)
      {
        this.serverProtos = require(filePath);
      }
      else if (type === CLIENT)
      {
        this.clientProtos = require(filePath);
      }
      else
      {
        this.setFlatBufferData(type, filePath);
      }

      // Set version to modify time
      const time = stats.mtime.getTime();
      if (this.version < time)
      {
        this.version = time;
      }

      // Watch file
      const watcher = fs.watch(filePath, this.onUpdate.bind(this, type, filePath));
      if (this[watchers].has(baseName))
      {
        this[watchers].get(baseName).close();
      }
      this[watchers].set(baseName, watcher);
    }
    else if (stats.isDirectory())
    {
      const files = fs.readdirSync(filePath);
      files.forEach(val =>
      {
        const fPath = path.join(filePath, val);
        const stats = fs.statSync(fPath);
        if (stats.isFile()) this.setProtos(type, fPath);
      });
    }

  }

  onUpdate(type, filePath, event)
  {
    if (event !== 'change')
    {
      return;
    }
    try
    {
      if (type === SERVER || type === CLIENT)
      {
        const data = fs.readFileSync(filePath, 'utf8');
        if (type === SERVER)
        {
          this.serverProtos = JSON.parse(data);
        }
        else if (type === CLIENT)
        {
          this.clientProtos = JSON.parse(data);
        }
      }
      else
      {
        this.setFlatBufferData(type, filePath);
      }
      this.version = fs.statSync(filePath).mtime.getTime();
      this.logger && this.logger.debug('change proto file , type : %j, path : %j, version : %j', type, filePath, this.version);
    }
    catch (err)
    {
      this.logger && this.logger.warn('change proto file error! path : %j', filePath);
      this.logger && this.logger.warn(err);
    }
  }

  setFlatBufferData(type, filePath)
  {
    const extName = path.extname(filePath);
    if (extName === '.json')
    {
      const data = fs.readFileSync(filePath);
      if (type === ServerRouteDic)
      {
        this.serverRouteDicObject = JSON.parse(data);
      }
      else if (type === ClientRouteDic)
      {
        this.clientRouteDicObject = JSON.parse(data);
      }
    }
    else
    {
      if (type === ServerMessageData)
      {
        this[serverProtoBuffer] = parseData.compileSchema(filePath);
      }
      else if (type === ClientMessageData)
      {
        this[clientProtoBuffer] = parseData.compileSchema(filePath);
      }
    }
  }

  stop(force, cb)
  {
    for (const watcher of this[watchers].values())
    {
      if (watcher)
        watcher.close();
    }
    this[watchers].clear();
    this[watchers] = null;
    process.nextTick(cb);
  }
}

module.exports = function(app, opts)
{
  return new Index(app, opts);
};
Index.prototype.name = '__decodeIO__protobuf__';
