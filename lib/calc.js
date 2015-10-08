
var Model;
var Row = require('cocotte-row');

module.exports = function (_Model) {
  Model = _Model;
  _Model.calc = calc;
  _Model.uncalc = uncalc;
  _Model._removeCalcListeners = removeCalcListeners;
};

/**
 * 自動計算をフィールドに設定します
 *
 *  watchesで指定したフィールドやデータソースに変更があると
 *  自動的にfieldNameで指定したフィールドの値をformulaの戻り値に設定することができます
 *  
 *  しかし、このフィールドは自動計算を確実に保証するものではありません
 *  あくまで変更を直接値を代入して変更することもできます
 *  直接値を代入させないように自動計算のフィールドは読み取り専用にすることを推奨します
 *  
 *  fieldNameの記述について
 *
 *    モデルフィールドの場合ははフィールド名をそのまま記述します
 *    データソースフィールドの場合はdatasourceName.fieldNameです
 *    
 *  watchesの記述について
 *
 *    配列でモデルのアイテム（フィールド名、データソース名）を指定します
 *    データソースの場合はさらに監視対象を行の追加削除やフィールドに絞ることができます
 *
 *    モデルフィールドの監視はfieldNameとします
 *    データソースフィールドでは次の３つの対象を監視できます
 *      行の追加・削除のみを監視   datasourceName
 *      全てのフィールドの値を監視 datasourceName.*
 *      特定のフィールドの値を監視 datasourceName.fieldName
 *
 *    フィールドの監視を行うと行の追加・削除の監視は明示しなくとも監視対象になります
 *
 *  formulaについて
 *
 *    計算結果を返す関数は、自動計算するフィールドによって引数が異なります
 *    モデルフィールドでは引数はmodelのみです
 *    データソースフィールドでは引数はmodelと現在計算をしている行インスタンスです
 * 
 * @method calc
 * @param  {Model}    model
 * @param  {String}   fieldName  自動計算するフィールド
 * @param  {Array}    watches    変更を監視する項目
 * @param  {Function} formula    計算結果を取得する関数
 * @return {Boolean}  success    設定できたかどうか
 */
function calc(model, fieldName, watches, formula) {

  // 既に自動計算を設定
  if (model._calc[fieldName]) {
    return false;
  }

  // 計算対象フィールド
  var calcField = getInfo(model, fieldName);
  if (!calcField || calcField.type === 'ds' && !calcField.field) {
    return false;
  }

  var listeners = [];
  function add (event, name, cb) {
    model.on(event + ' ' + name, cb);
    listeners.push([event, name, cb]);
  }

  var aRowCb; // 計算フィールドを持つ行が追加された時のコールバック
  var cb;     // 監視対象のフィールドの値が変更された時のコールバック

  // 更新対象がモデルのフィールド
  if (calcField.type === 'field') {
    cb = getModelFieldCb(model, fieldName, formula);

  // 更新対象がデータソースのフィールド
  } else {
    aRowCb = getARowCb(model, calcField.field, formula);
    add('added', calcField.member, aRowCb);
    cb = getAllRowsCb(model[calcField.member], aRowCb);
  }

  if (cb) {
    cb();
  } else {
    return false;
  }

  // 監視対象のフィールド
  if (!Array.isArray(watches)) {
    watches = [watches];
  }

  /*
   * 次のフォーマットに変換する
   *  {メンバー名: 監視情報....}
   * モデルフィールド監視情報
   *    {type: 'field'}
   * データソースフィールド監視情報
   *    {
   *      type     : 'ds',
   *      allFields: true,
   *      fields   : [fieldName,...]
   *    }
   */
  var objWatches = watches.reduce(function(x, watch){
    if (x === null) {
      return null;
    }
    var info = getInfo(model, watch);
    if (!info) {
      return null;
    }
    var type = info.type;
    var name = info.member;
    delete info.member;
    var exist = x[name];
    if (!exist) {
      x[name] = info;
      delete info.field;
    } else if (type === 'ds'){
      if (info.allFields) {
        exist.allFields = true;
      }
      if (info.field) {
        exist.fields.push(info.field);
        delete info.field;
      }
    }
    return x;
  },{});
  if (!objWatches) {
    // 不正なフィールドの指定なら終了
    return false;
  }

  // イベントリスナーの追加
  Object.keys(objWatches).forEach(function(member){
    var watch = objWatches[member];

    // モデルフィールドの監視
    if (watch.type === 'field') {
      add('updated', member, cb);

    // データソースの監視
    } else {
      add('added', member, cb);
      add('removed', member, cb);
      if (watch.allFields) {
        add('updated', member, cb);
      } else if (watch.fields.length) {
        var cb2 = getCbOnWatch(watch.fields, cb);
        add('updated', member, cb2);
      }
    }
  });

  model._calc[fieldName] = listeners;
  model.emit('set calc', fieldName);
  return true;
}

/**
 * 自動計算を解除する
 * @method uncalc
 * @param  {Model}   model
 * @param  {String}  fieldName
 * @return {Boolean} success
 */
function uncalc (model, fieldName) {
  var calc = model._calc;
  var listeners = calc[fieldName];
  if (listeners) {
    listeners.forEach(function(l) {
      model.removeListener(l[0] + ' '+ l[1], l[2]);
    });
    delete calc[fieldName];
    model.emit('unset calc', fieldName);
    return true;
  } else {
    return false;
  }
}

/**
 * モデルからフィールドやデータソースを排除する際に
 * 自動計算のイベントリスナーの解除を行います。
 * 監視対象の一部でも排除する対象が入っている場合は解除します 
 * @method removeCalcListeners
 * @param  {Model}  model
 * @param  {String} name
 */
function removeCalcListeners (model, name) {
  var calc = model._calc;
  Object.keys(calc).forEach(function(fieldName){
    // 一部でも含む
    var includes = calc[fieldName].some(function(l){return l[1] === name;});
    if (includes) {
      uncalc(model, fieldName);
      delete calc[fieldName];
    }
  });
}

// ------- 以下ローカル関数 -------

/**
  * 次のフォーマットに変換する
  * モデルフィールド 
  *    {
  *      type:'field',
  *      member: fieldName
  *     }
  * データソースフィールド
  *    {
  *      type     : 'ds',
  *      member   : dsName,
  *      allFields: true,           'データソース名.*'            のみ設定
  *      field    : fieldName ,     'データソース名.フィールド名' のみ設定
  *      fields   : [fieldName] / []
  *    }
  * @method getInfo
  * @param  {Model}  model
  * @param  {String} value
  * @return {Object} info
  */
function getInfo(model, value) {
  var _tmp = value.split('.');
  var len = _tmp.length;
  var type = Model.getType(model, _tmp[0]);
  if (type === 'ds') {
    var dsName = _tmp[0];
    if (len === 1) {
      // 追加削除の監視
      return {
        type  : 'ds',
        member: dsName,
        fields: []
      };

    } else if (len === 2) {
      var fName = _tmp[1];
      // フィールドの監視
      if (fName ==='*') {
        return {
          type      : 'ds',
          member    : dsName,
          allFields : true,
          fields    : []
        };
      } else if (fName === 'id' || fName === 'state' || model[dsName].fields[fName]) {
        return {
          type  : 'ds',
          member: dsName,
          field : fName,
          fields: [fName]
        };
      }
    }

  } else if (type === 'field' && len === 1) {
    return {
      type: 'field',
      member: value
    };
  }
  return null;
}

/**
 * モデルフィールドの自動計算時のコールバック関数取得
 * @method getModelFieldCb
 * @param  {Model}       model
 * @param  {String}      fieldName
 * @param  {Function}    formula
 * @return {Function}    callback
 */
function getModelFieldCb(model, fieldName, formula) {
  return function () {
    model[fieldName] = formula(model);
  };
}

/**
 * データソースフィールド自動計算時のコールバック関数取得（一行だけ）
 * @method getARowCb
 * @param  {Model}    model
 * @param  {String}   fieldName
 * @param  {Function} formula
 * @return {Function} callback
 */
function getARowCb (model, fieldName, formula) {
  return function (row) {
    Row.setAfter(row, fieldName, formula(model, row));
  };
}

/**
 * データソースフィールド自動計算時のコールバック関数取得（全行）
 * @method getAllRowsCb
 * @param  {Datasource}  ds
 * @param  {Function}    formula
 * @return {Function}    callback
 */
function getAllRowsCb (ds, aRowCb) {
  return function () {
    ds.forEach(function(row) {
      aRowCb(row);
    });
  };
}

/**
 * 更新対象フィールドの場合にのみ再計算するコールバック関数
 * @method getCbOnWatch
 * @param  {Array}      fields
 * @param  {Function}   callback
 * @return {Function}   callbackOnWatch
 */
function getCbOnWatch (fields, callback) {
  return function(row, name) {
    if (fields.indexOf(name) !== -1) {
      callback();
    }
  };
}
