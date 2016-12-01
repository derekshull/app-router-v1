//FUNCTIONS
function removeClass(selector, myClass) {
  // get all elements that match our selector
  elements = document.querySelectorAll(selector);

  // remove class from all chosen elements
  for (var i=0; i<elements.length; i++) {
    elements[i].classList.remove(myClass);
  }
}

function addClass(selector, myClass) {

  // get all elements that match our selector
  elements = document.querySelectorAll(selector);

  // add class to all chosen elements
  for (var i=0; i<elements.length; i++) {
    elements[i].classList.add(myClass);
  }
}

//FASTCLICK LISTENER
if ('addEventListener' in document) {
    document.addEventListener('DOMContentLoaded', function() {
        FastClick.attach(document.body);
    }, false);
}

//THINGS TO DO WHEN WEB COMPONENTS ARE DONE LOADING
window.addEventListener('WebComponentsReady', function() { //after the web components have loaded
    //THINGS TO RUN ONCE A PARTIAL HAS LOADED
    var router = document.querySelector('app-router'); //get app-router

    router.addEventListener('activate-route-start', function(event) {
        if (event.detail.oldRoute) {
            let newRoute = event.detail.route;
            let oldRoute = event.detail.oldRoute;

            oldRoute.classList.add("route-moveOut");
            setTimeout(function(){
                oldRoute.classList.remove("route-moveOut");
            }, 500);
        }
    }); 

    router.addEventListener('activate-route-end', function(event) {
        Prism.highlightAll();
    });
    router.init(); //initiate the router to go to the new route
});