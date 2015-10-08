cocotte-model
===========

# はじめに

モデルは複数のデータソースを保有し、それらを連携させる事が出来ます  
また、モデルは、EventEmitterを継承している以外は固有のプロパティがありません
フィールド・データソース・メソッドを追加していきます


```
// モデルの作成
var Model = require('cocotte-model');
var model1 = new Model();

// フィールドの追加
Model.extend(model1, 'name', new Field.Text());
Model.extend(model2, 'age' , new Field.Number());

// データソースの追加
Model.extend(model1, 'ds1', ds1);
Model.extend(model1, 'ds2', ds2);

// メソッドの追加
Model.extend(model1, 'save', function() {
  // (略)
});
```

# API

## 初期化

### 単純な初期化

直後にはデータソースを保持していないため、後から追加する必要があります

```
var model1 = new Model();
```

### 機能を設定する初期化

引数にオブジェクトを渡す事で、フィールド・データソース・メソッドを設定することができます  

```
var model = new Model({
  counter: numberField,
  company: companyDs,
  employee: employeeDs,
  add: function (companyName, employeeName) {
    this.counter = (this.counter || 0) + 1;
    this.company.add({id: this.counter, name: companyName});
    this.employee.add({id: this.counter, name: employeeName});
  }
});
model.add('japan bank', 'tanaka takashi');
```

## プロパティ

モデルには固定名のプロパティは

### {{field name}}

フィールドを追加すると、モデルからはフィールド名で直接操作する事ができます


### {{datasource name}}

データソースを追加すると、モデルからはデータソース名で直接取得する事ができます

### {{method name}}

機能拡張によって設定されたメソッドを呼び出します


## クラスメソッド

### extend ({Model} model, {String} name, {Field|Datasource|Function} field|ds|method)

フィールド・データソース・メソッドを追加することができます  
nameは、すでにオブジェクトに設定されているプロパティ名と衝突してはいけません  
プロトタイプは、ObjectとEventEmitterから継承したプロパティを引き継いでいるため
`toString`や`on`なども使用できないため注意する必要があります  
この制限は、コンストラクタの引数のキー名にも適用されます

### remove ({Model} model, {String} name)

フィールド・データソース・メソッドを削除する事が出来ます

### calc ({Model} model, {String} fieldName, {Array} watch, {Function} formula)

フィールドに自動計算を設定します  

watchで設定した項目を監視し、変更があった場合はfieldNameのフィールドに
formulaの戻り値を設定します  
同じフィールドに複数の自動計算を設定することはできません

fieldNameの記述について

  + モデルフィールドの場合ははフィールド名をそのまま記述します
  + データソースフィールドの場合はdatasourceName.fieldNameです

watchesの記述について

  + 配列でモデルのアイテム（フィールド名、データソース名）を指定します
  + データソースの場合はさらに監視対象を行の追加削除やフィールドに絞ることができます
      + モデルフィールドの監視はfieldNameとします
      + データソースフィールドでは次の３つの対象を監視できます
          + 行の追加・削除のみを監視   datasourceName
          + 全てのフィールドの値を監視 datasourceName.*
          + 特定のフィールドの値を監視 datasourceName.fieldName
  + フィールドの監視を行うと行の追加・削除の監視は明示しなくとも監視対象になります

formulaについて

  + 計算結果を返す関数は、自動計算するフィールドによって引数が異なります
  + モデルフィールドでは引数はmodelのみです
  + データソースフィールドでは引数はmodelと現在計算をしている行インスタンスです

### uncalc ({Model} model, {String} fieldName)

フィールドの自動計算を解除します

## イベント

### extended ({String} name)

フィールド・データベース・メソッドのいずれかが追加された

### removed ({String} name)

フィールド・データベース・メソッドのいずれかが削除された

### set calc ({String} fieldName)

自動計算がフィールドに設定された

### set calc ({String} fieldName)

自動計算がフィールドから解除された

### updated %fieldName% ()

フィールドが更新された

### added %datasourceName% ({Row} row)

データソースに行が追加された

### removed %datasourceName% ({Row} row)

データソースの行が削除された

### updated %datasourceName% ({Row} row, {String} fieldName)

データソースの行のフィールドが更新された

# ビューモデル

モデルはビューモデルに登録することで、ビューとの連携が可能になります  
モデルやデータソースを直接ビューと連携させる事はできません  
次のようにすることで、モデルとビューを連携する事ができます。  
詳しくは`cocotte-viewmodel`のAPIを確認してください

```
var ViewModel = require('cocotte-viewmodel');
var vm = new ViewModel(model, 'mountNode');
```


