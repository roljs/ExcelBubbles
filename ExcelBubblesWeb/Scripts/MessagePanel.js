//This object may be passed to the show methods on the MessagePanel to set options.
function MessagePanelOptions() {
    this.fillHeight = false;
    this.modal = false;
    this.panelClickClosesPanel = false;
    this.autoCloseTime = false;
    //this.autoCloseTime = 3000;
}

//Used to set any unspecified options to their defaults.
MessagePanelOptions.prototype.apply = function (options) {
    this.modal = (options && options.modal != null) ? options.modal : this.modal;
    this.panelClickClosesPanel = (options && options.panelClickClosesPanel != null) ? options.panelClickClosesPanel : this.panelClickClosesPanel;
    this.autoCloseTime = (options && options.autoCloseTime != null) ? options.autoCloseTime : this.autoCloseTime;
    this.fillHeight = (options && options.fillHeight != null) ? options.fillHeight : this.fillHeight;
    return this;
};


//Constructor for the MessagePanel. This will add the required elements to the DOM, if they do not already exist.
function MessagePanel(name) {
    var self = this;

    this.name = name;
    this.options = new MessagePanelOptions();

    this.messageDiv = $("#messageBox" + this.name);
    if (this.messageDiv.length == 0) {
        this.messageDiv = $(this.messageBoxHtml()).prependTo("body");
    }
    this.messageDiv[0].messagePanel = this;
    this.messageDiv.click(function () {
        this.messagePanel.onPanelClick();
    });
    this.modalDiv = $("#messageBoxModalPanel" + this.name);
    if (this.modalDiv.length == 0) {
        this.modalDiv = $(this.messageBoxModalHtml()).prependTo("body");
    }

}

//Some default values to use for content. Change the paths and container templates here for all MessagePanel objects.
MessagePanel.prototype.messageBoxHtml = function () { return "<div id='messageBox" + this.name + "' class='messageBox' style='display:none;'></div>" };
MessagePanel.prototype.messageBoxHtmlContent = function () { return "<h2 id='messageBoxHeading" + this.name + "' class='messageBoxHeading'></h2><div class='messageBoxHeadingCloseDiv'><img id='messageBoxHeadingCloseIcon" + this.name + "' class='messageBoxHeadingCloseIcon' src='' href='#' alt='Close' /></div><div id='messageBoxContent" + this.name + "' class='messageBoxContent'></div>" };
MessagePanel.prototype.messageBoxModalHtml = function () { return "<div id='messageBoxModalPanel" + this.name + "' class='messageBoxModalPanel' style='display:none;'></div>" };
//Default icons used in the panel.
MessagePanel.prototype.errorIcon = "img/MetroError.png";
MessagePanel.prototype.infoIcon = "img/MetroInfo.png";
MessagePanel.prototype.closeIcon = "img/MetroClose.png";
//the speed with which to open and close the message panel.
MessagePanel.prototype.effectSpeed = "fast";

//This will expose the container element as a jQuery.
MessagePanel.prototype.content = function () {
    return $("#messageBoxContent" + this.name);
};

//Default handler for clicking on the panel. This will close the panel if the panelClickClosesPanel property of the panel's options is set to true.
MessagePanel.prototype.onPanelClick = function () {
    if (this.options.panelClickClosesPanel) {
        this.closePanel();
    }
};

//Cancels any timeouts previously set up to automatically close the MessagePanel.
MessagePanel.prototype.clearTimeOut = function() {
    if (this.slideUpTimeout != null)
        clearTimeout(this.slideUpTimeout);
};

//Creates a timeout to automatically close the panel after the number of milliseconds specified in the autoCloseTime property on the MessagePanel's options.
MessagePanel.prototype.initiateCloseTime = function () {
    this.slideUpTimeout = setTimeout(function () {
        this.closePanel();
    }, this.options.autoCloseTime);
};

//Displays a message panel with the given title and options. The default errorIcon is used. If the title is not specified, it is defaulted to "Error". Default options are used if no options are specified.
MessagePanel.prototype.showErrorMessage = function (message, title, messagePanelOptions) {
    if (title == null)
        title = "Error";
    this.showDialog(message, this.errorIcon, title, messagePanelOptions);
};

//Displays a message panel with the given title and options. The default infoIcon is used. If the title is not specified, it is defaulted to "Message". Default options are used if no options are specified.
MessagePanel.prototype.showInfoMessage = function (message, title, messagePanelOptions) {
    if (title == null)
        title = "Message";
    this.showDialog(message, this.infoIcon, title, messagePanelOptions);
};

//Displays a message panel with the given icon, title and options. If the title is not specified, it is defaulted to "Message". If the Icon is not specified, no icon is displayed. Default options are used if no options are specified.
MessagePanel.prototype.showDialog = function (content, icon, title, messagePanelOptions) {
    var self = this;

    this.clearTimeOut();
    //We augment the given optinos with the default values.
    this.options = new MessagePanelOptions().apply(messagePanelOptions);
    //Build the default template.
    var iconTag = icon ? "<img id='messageBoxHeadingIcon" + this.name + "' class='messageBoxHeadingIcon' src='" + icon + "' />" : "";
    var titleText = title || "Message";
    this.messageDiv.html(this.messageBoxHtmlContent());
    this.messageDiv.find("#messageBoxHeadingCloseIcon" + this.name).click(function () {
        self.closePanel();
        return false;
    });
    this.messageDiv.find("#messageBoxHeading" + this.name).html(iconTag + titleText);
    var a = this.messageDiv.find("#messageBoxHeading" + this.name).html();
    this.messageDiv.find("#messageBoxHeadingCloseIcon" + this.name).prop("src", this.closeIcon);
    //Set the given content
    this.messageDiv.find("#messageBoxContent" + this.name).html(content);
    this.updatePosition();

    //Display an overlay div if the dialog should be modal.
    if (this.options.modal) {
        this.modalDiv.fadeIn(this.effectSpeed);
    }
    //Display the MessagePanel
    this.messageDiv.slideDown(this.effectSpeed);
    //Initiate the timer to automatically close the panel if the autoCloseTime is a number.
    if (!isNaN(this.options.autoCloseTime) && this.options.autoCloseTime > 0) {
        this.initiateCloseTime();
    }
    $(window).resize(
    function() {
        self.updatePosition();
    });
};

//Update the position of the message panel, and it's width if it is wider han the window.
MessagePanel.prototype.updatePosition = function () {
    
    if (this.options.fillHeight) {
        var padding = this.messageDiv.outerHeight() - this.messageDiv.height();
        this.messageDiv.height($(window).innerHeight() - padding);
    } else {
        this.messageDiv.css("height", "");
    }
    
};

//clear any timers for closing the panel automatically and closes the message panel and modal overlay div.
MessagePanel.prototype.closePanel = function () {
    this.clearTimeOut();
    this.messageDiv.slideUp(this.effectSpeed);
    if (this.options.modal) {
        this.modalDiv.fadeOut(this.effectSpeed);
    }
};