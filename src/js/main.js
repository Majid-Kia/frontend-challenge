//var ko = require('knockout');
var ko = require('knockout');
var createUser = require ('../../sdk/index');
var validation = require('knockout.validation');

var viewModel = {

    //track form steps
    activeStep : ko.observable(1),

    // if user do register dont show form and show succeed message
    succeedRegister : ko.observable(false),

    // form fields values
    name: ko.observable().extend({
      minLength: 2,
      required: {
        message: 'Please enter your name.'
      }
    }),
    age: ko.observable().extend({
      min: 1, 
      max: 100,
      required: {
        message: 'Please enter your age.'
      }
      
    }),
    newsletter: ko.observable().extend({required: true}),
    email: ko.observable().extend({
      // custom message
      required: {
          message: 'Please enter your email address.'
      },
      email: true,
     
    }),
    newsletterOptions: ['daily', 'weekly', 'monthly'],

    // form go to next step
    goToNextStep : function(){

      if(this.name.isValid() && this.age.isValid()){
        viewModel.errors.showAllMessages(false)
        var  previousStep  = this.activeStep();
        this.activeStep(previousStep + 1)
      }else{
        viewModel.errors.showAllMessages()
      }
      
    },

    // form go back 1 step
    goToPrevStep : function(){
      var  previousStep  = this.activeStep();
      this.activeStep(previousStep - 1)
    },

    // submit form
    submit: function() {
      // check erros before fire submit
      if (viewModel.errors().length === 0) {
        var userData = {
          name: this.name(),
          age: Number(this.age()),
          email: this.email(),
          newsletter: this.newsletter(),
        }
        createUser(userData).then(function(response){
          viewModel.succeedRegister(true);
          console.log(response)
        })
      }
      else {
          viewModel.errors.showAllMessages();
      }
    },

};

viewModel.errors = ko.validation.group(viewModel);

ko.applyBindings(viewModel);


