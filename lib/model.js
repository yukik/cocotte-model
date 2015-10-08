/*
 * @license
 * cocotte-model v0.2.0
 * Copyright(c) 2014 Yuki Kurata <yuki.kurata@gmail.com>
 * MIT Licensed
 */
module.exports = Model;

/*global window*/

// クライアント用
if (typeof window === 'object') {
  if (!window.Cocotte){
    window.Cocotte = {};
  }
  window.Cocotte.Model = Model;
}

/**
 * dependencies
 */
var util = require('util');
var events = require('events');
var Datasource = require('cocotte-datasource');
var Field = require('cocotte-field');

/**
 * モデル
 * @method Model
 * @param  {Object} config
 */
function Model (config) {
  var model = this;
  setHiddenProperties(model);
  Object.keys(config).forEach(function(name){
    Model.extend(model, name, config[name]);
  });
}

util.inherits(Model, events.EventEmitter);

/**
 * 隠しプロパティの設定
 * @method setHiddenProperties
 * @param  {Model}            model
 */
function setHiddenProperties(model) {
  Object.defineProperties(model, {
    _dsListeners: {
      value: {},
      writable: false,
      enumerable: false,
      configurable: false
    },
    _types: {
      value: {},
      writable: false,
      enumerable: false,
      configurable: false
    },
    _values: {
      value: {},
      writable: false,
      enumerable: false,
      configurable: false
    },
    _calc: {
      value: {},
      writable: false,
      enumerable: false,
      configurable: false
    }
  });
}

/**
 * フィールド・データソース・メソッドを追加する
 * @method extend
 * @param  {Model}  model
 * @param  {String} name
 * @param  {Mixed}  extension
 */
Model.extend = function extend (model, name, extension) {
  var msg;
  if (Model.getType(model, name) !== 'unuse') {
    msg = name + ':既に使用されている名前のため機能を追加できません';
    throw new Error(msg);
  }

  // メソッド
  if (typeof extension === 'function') {
    model[name] = extension;
    model._types[name] = 'method';

  // フィールド
  } else if (extension instanceof Field) {
    extendField(model, name, extension);
    model._types[name] = 'field';

  // データソース
  } else if (extension instanceof Datasource) {
    extendDatasource(model, name, extension);
    model._types[name] = 'ds';

  // 不明
  } else {
    msg = name + ':フィールド・データソース・メソッドのいずれでもありません';
    throw new Error(msg);
  }

  model.emit('extended', name);
};

/**
 * 指定したプロパティ名のタイプを次の5つの中から返す
 *     field  : モデルに直接設定されたフィールド
 *     ds     : データソース
 *     method : メソッド
 *     reserve: 使用が制限されている名前(EventEmitter関連など)
 *     unuse  : 未使用
 * @method getType
 * @param  {Model}  model
 * @param  {String} name
 * @return {String} type
 */
Model.getType = function getType(model, name) {
  var type = model._types[name];
  return type || (hasProperty(model, name) ? 'reserve' : 'unuse');
};

/**
 * オブジェクトが指定したプロパティを持つかどうか
 * プロトタイプも調査する
 * @method hasProperty
 * @param  {Object}    target
 * @param  {String}    name
 * @return {Boolean}   has
 */
function hasProperty(target, name) {
  while(target) {
    if (target.hasOwnProperty(name)) {
      return true;
    }
    target = Object.getPrototypeOf(target);
  }
  return false;
}

/**
 * フィールドをプロパティ定義する
 * @method extendField
 * @param  {Model}  model
 * @param  {String} name
 * @param  {Field}  field
 */
function extendField(model, name, field) {
  var values = model._values;
  values[name] = null;
  Object.defineProperty(model, name, {
    get: function () {
      return values[name];
    },
    set: function (value) {
      field.valid(value);
      if (!field.equal(values[name], value)) {
        values[name] = value;
        model.emit('updated ' + name);
      }
    },
    enumerable: true,
    configurable: true
  });
}

/**
 * データソースをプロパティ定義する
 * @method extendDatasource
 * @param  {Model}      model
 * @param  {String}     name
 * @param  {Datasource} ds
 */
function extendDatasource(model, name, ds) {
  model[name] = ds;
  function added (row) {
    model.emit('added ' + name, row);
  }
  function updated (row, fieldName) {
    model.emit('updated ' + name, row, fieldName);
  }
  function removed (row) {
    model.emit('removed ' + name, row);
  }
  model._dsListeners[name] = {added: added, updated: updated, removed: removed};
  ds.on('added', added);
  ds.on('updated', updated);
  ds.on('removed', removed);
}

/**
 * フィールド・データソース・メソッドを排除する
 * @method remove
 * @param  {Model}  model
 * @param  {String} name
 */
Model.remove = function remove (model, name) {
  switch(model._types[name]) {
  case 'field':
    removeField(model, name);
    break;
  case 'ds':
    removeDatasource(model, name);
    break;
  case 'method':
    delete model[name];
    break;
  default:
    return;
  }
  removeListeners(model, name);
  delete model._types[name];
  model.emit('removed', name);
};

/**
 * すべてのフィールド・データソース・メソッドを排除する
 * @method clear
 * @param  {Model} model
 */
Model.clear = function clear(model) {
  Object.keys(model).forEach(function(name){
    Model.remove(model, name);
  });
};

/**
 * フィールドを排除する
 * @method removeField
 * @param  {Model}    model
 * @param  {String}    name
 */
function removeField(model, name) {
  delete model[name];
  delete model._values[name];
}

/**
 * データソースを排除する
 * @method removeDatasource
 * @param  {Model}        model
 * @param  {String}       name
 */
function removeDatasource(model, name) {
  var ds = model[name];
  var listeners = model._dsListeners[name];
  ds.removeListener('added', listeners.added);
  ds.removeListener('updated', listeners.updated);
  ds.removeListener('removed', listeners.removed);
  delete model._dsListeners[name];
  delete model[name];
}


/**
 * モデルからフィールドやデータソースを排除する際に
 * 関連するイベントリスナーを解除する
 * @method removeListeners
 * @param  {Model}   model
 * @param  {String}  name
 */
function removeListeners(model, name) {
  model.removeAllListeners('added ' + name);
  model.removeAllListeners('removed ' + name);
  model.removeAllListeners('updated ' + name);
  // 自動計算の解除
  Model._removeCalcListeners(model, name);
}

require('./calc')(Model);