/*global Cocotte*/

var isClient = typeof window === 'object';
var Model      = isClient ? Cocotte.Model      : require('..');
var Datasource = isClient ? Cocotte.Datasource : require('cocotte-datasource');
var Row        = isClient ? Cocotte.Row        : require('cocotte-row');
var Field      = isClient ? Cocotte.Field      : require('cocotte-field');

var companyConfig = {
  fields: {
    name: {type: Field.Text},
    employeeCount: {type: Field.Number}
  }
};

var employeeConfig = {
  fields: {
    company: {type: Field.Text},
    name: {type: Field.Text}
  }
};

var model = new Model({
  counter: new Field.Number(),
  company: new Datasource(companyConfig),
  employee: new Datasource(employeeConfig),
  add: function (company, employee) {
    var companyRow = this.company.find({name: company});
    if (!companyRow) {
      this.counter = (this.counter || 0) + 1;
      var companyId = 'c' + this.counter;
      companyRow = this.company.add({id: companyId, name: company});
    }
    this.employee.add({company: companyRow.id, name: employee});
  }
});

/* 自動計算の設定 */
Model.calc(model, 'company.employeeCount', ['employee.company'], function(model, companyRow){
  var id = companyRow.id;
  return model.employee.reduce(function(x, eply) {
    return eply.company === id ? x + 1 : x;
  }, 0);
});



model.add('japan bank', 'tanaka tatsuya');
model.add('japan soft', 'suzuki naoya');
model.add('japan soft', 'okawa musasi');
model.add('japan soft', 'mmnnjsa');


model.company.forEach(function(row){
  console.log(Row.data(row));
});

console.log();

model.employee.forEach(function(row){
  console.log(Row.data(row));
});


console.log(model._calc);
Model.remove(model, 'company');
console.log(model._calc);





