/*global Cocotte*/
var isClient = typeof window === 'object';
var Model      = isClient ? Cocotte.Model      : require('..');
var Datasource = isClient ? Cocotte.Datasource : require('cocotte-datasource');
var Row        = isClient ? Cocotte.Row        : require('cocotte-row');
var Field      = isClient ? Cocotte.Field      : require('cocotte-field');

var companyConfig = {
  fields: {
    name: {type: Field.Text}
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
    this.counter = (this.counter || 0) + 1;
    var cnt = this.counter;
    var companyId = 'c'+cnt;
    this.company.add({id: companyId, name: company});
    this.employee.add({id: 'e'+cnt+'-1', company: companyId, name: employee});
  }
});

model.add('japan bank', 'tanaka tatsuya');
model.add('japan soft', 'suzuki naoya');


model.company.forEach(function(row){
  console.log(Row.data(row));
});


model.employee.forEach(function(row){
  console.log(Row.data(row));
});





