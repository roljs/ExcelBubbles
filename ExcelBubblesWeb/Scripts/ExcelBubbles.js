//Global variables
var _values = [];
var _colDefs = {};

var _allCols = [];

var _OM;
var _settings;

var _showHighlighting = false;
var _showColorLabels = false;
var _drawGradient = false;
var _minValue = '9BBB3B';
var _maxValue = 'C0504D';
var _bubblesMode = "DIRECT";
var _primaryKey = null;
var _groupBy = null;

var _detailData = null;
var _primaryColumnIndex = 0;
var _currentSelectedRow = null;
var _selectedPrimaryKey = null;

var _dataBinding = null;
var _detailDataBinding = null;


var myMessageBox;
var mySettingsBox;

$.getDocHeight = function () {
    return Math.max(
        $(window).height(),
        /* For opera: */
        document.documentElement.clientHeight
    );
};

$.getDocWidth = function () {
    return Math.max(
        $(window).width(),
        /* For opera: */
        document.documentElement.clientWidth
    );
};

$().ready(function () {
    myMessageBox = new MessagePanel("Error");
    mySettingsBox = new MessagePanel("Settings");
});

//function called to connect Javascript world to the document
Office.initialize = function (reason) {
    window.onresize = function (event) {
        ga("send", "event", "Actions", "Resized");

        for (var i = 0; i < Processing.instances.length; i++) {
            Processing.instances[i].setup();
            Processing.instances[i].draw();
        }
    }

    if (reason == "inserted")
        ga("send", "event", "Actions", "Inserted");
    else
        ga("send", "event", "Actions", "DocumentOpened");


    _OM = Office.context.document;
    _settings = Office.context.document.settings;

    //initialize settings if they've already been set to the file
    if (_settings.get("bubblesMode") != null) {
        _bubblesMode = _settings.get("bubblesMode");
    }

    if (_settings.get("primaryKey") != null) {
        _primaryKey = _settings.get("primaryKey");
    }

    if (_settings.get("groupBy") != null) {
        _groupBy = _settings.get("groupBy");
    }

    if (_settings.get("minColor") != null) {
        _minValue = _settings.get("minColor");
    }

    if (_settings.get("maxColor") != null) {
        _maxValue = _settings.get("maxColor");
    }

    if (_settings.get("colDefs") != null) {
        _colDefs = _settings.get("colDefs");
    }

    _OM.bindings.getByIdAsync("DetailData", dataReturned);
    _OM.bindings.getByIdAsync("Data", dataReturned);

}

//check to see if we have bound data, if not the ask for it
function dataReturned(result) {
    var binding = result.value;
    //we have data
    if (binding != null) {
        if (binding.id == "Data") {
            _dataBinding = binding;
            getBindingValues(binding);
        }
        else { //DetailData
            _detailDataBinding = binding;
            getBindingDetailValues(binding);
        }
    }
}

function setBindingDetailData() {
    _OM.bindings.addFromPromptAsync(Office.BindingType.Table,
        {
            id: "DetailData",
            promptText: "Please select at least 2 columns and > 1 row of data"
        },
        function (asyncResult) {
            if (asyncResult.status == Office.AsyncResultStatus.Succeeded) {
                if (asyncResult.value.columnCount < 2 || asyncResult.value.rowCount < 1) {
                    _OM.bindings.releaseByIdAsync("DetailData");
                    myMessageBox.showErrorMessage("Insufficient detail data.");
                }
                else {
                    _detailDataBinding = asyncResult.value;
                    getBindingDetailValues(asyncResult.value);

                }
            }
        }
    );
}

function setBinding() {
    ga("send", "event", "Actions", "SelectTable");

    var prompt_text = "Please select a data table to visualize.";
    if (_bubblesMode == 'DETAIL') {
        prompt_text = "Please select the primary data table";
    }

    //Reset column mappings as this is a new binding
    _colDefs = {};
    _OM.bindings.addFromPromptAsync(Office.BindingType.Table,
        {
            id: "Data",
            promptText: prompt_text
        },
        function (asyncResult) {
            if (asyncResult.status == Office.AsyncResultStatus.Succeeded) {
                _dataBinding = asyncResult.value;
                getBindingValues(asyncResult.value);
            }
        }
    );
}

//Fill in the combo boxes in settings for detail keys
function PopulatePrimaryKey() {
    if (_detailData == null) {
        return;
    }

    var header = _detailData.headers[0];

    var primaryKeyColumns = document.getElementById("primaryKey");
    var groupByColumns = document.getElementById("groupBy");

    primaryKeyColumns.options.length = 0;
    groupByColumns.options.length = 0;

    for (var i = 0; i < header.length; i++) {
        primaryKeyColumns[i] = new Option(header[i], header[i]);
        groupByColumns[i] = new Option(header[i], header[i]);

        if (header[i] == _primaryKey) {
            primaryKeyColumns.selectedIndex = i;
        }

        if (header[i] == _groupBy) {
            groupByColumns.selectedIndex = i;
        }
    }
}

function getBindingValues(binding) {
    //adding data changed event
    binding.addHandlerAsync(
            Office.EventType.BindingDataChanged,
            DataChanged
        );
    binding.addHandlerAsync(
            Office.EventType.BindingSelectionChanged,
            SelectionChanged
        );

    refreshBubbles(binding, true);
    ga("send", "event", "Actions", "RenderBinding");

}

function getBindingDetailValues(binding) {

    //adding data changed event
    binding.addHandlerAsync(
            Office.EventType.BindingDataChanged,
            DataChanged
        );
    binding.getDataAsync(
        {
            coercionType: Office.CoercionType.Table,
            valueFormat: Office.ValueFormat.Unformatted,
            filterType: Office.FilterType.OnlyVisible
        },
        function (result) {
            _detailData = result.value
            PopulatePrimaryKey();
        });
}

//Binding selection changed method
function SelectionChanged(changedArgs) {
    if (_bubblesMode == 'DIRECT') {
        return;
    }

    _currentSelectedRow = changedArgs.startRow;

    refreshBubbles(_detailDataBinding, false);
    ga("send", "event", "Actions", "SelectionChange");

}

//handle data change
function DataChanged(changedArgs) {
    refreshBubbles(changedArgs.binding, true);
    ga("send", "event", "Actions", "DataChange");

}

function refreshBubbles(binding, forceRefresh) {
    var filter_type = Office.FilterType.OnlyVisible;
    if (binding.id == "Data" && _bubblesMode == "DETAIL") {
        filter_type = Office.FilterType.All;
    }

    try {
        binding.getDataAsync(
                {
                    coercionType: Office.CoercionType.Table,
                    valueFormat: Office.ValueFormat.Unformatted,
                    filterType: filter_type
                },
                function (dataResult) {
                    if (binding.id == "Data") {
                        initializeValues(dataResult, forceRefresh);
                    }
                    else {
                        _detailData = dataResult.value;
                        refreshBubbles(_dataBinding, forceRefresh);
                    }
                }
            );
    }
    catch (e) {
    }
}

//Used to get column types for direct mode
//Checks the first row to infer which column should be Title, Size and Color based on the data types of the values in eac column
//The logic tries to match the first column oftype string to the Title, the first column of type numeric to the size and the second column of type numeric to color
//If no string column then use the size column as title
//If no color column then default to 0
//if no string or numeric columns then directo mode cannot be used

function getColumnTypes(table) {

    _colDefs = {};

    var firstRow = table.rows[0]
    for (var i = 0; i < firstRow.length; i++) {

        //If the current column is numeric and we haven't completed finding title, size and color 
        if (IsNumeric(convertBlankToDefault(firstRow[i])) && !colDefsComplete(_colDefs)) {
            if (_colDefs.sizeIndex == undefined) {
                _colDefs.sizeIndex = i;
            } else {
                _colDefs.colorIndex = i;
            }

        }
        else if (_colDefs.titleIndex == undefined) {
            _colDefs.titleIndex = i;
        }

        if (colDefsComplete(_colDefs)) { break };

    }

    //If we finished parsing all columns and we still haven't found a title, use the size as the title
    if (_colDefs.titleIndex == undefined) {
        _colDefs.titleIndex = _colDefs.sizeIndex;
    }

    //If we finished parsing all columns and we still haven't found a color, use the size as the color
    if (_colDefs.colorIndex == undefined) {
        _colDefs.colorIndex = -1;
    }

    _colDefs.titleHeader = table.headers[0][_colDefs.titleIndex];
    _colDefs.sizeHeader = table.headers[0][_colDefs.sizeIndex];
    _colDefs.colorHeader = table.headers[0][_colDefs.colorIndex];

    return _colDefs;
}

function colDefsComplete(_colDefs) {
    return _colDefs.titleIndex != undefined && _colDefs.sizeIndex != undefined && _colDefs.colorIndex != undefined;
}

function IsNumeric(val) {
    if (isNaN(parseFloat(val))) {
        return false;
    }
    return true
}

function convertBlankToDefault(value) {
    if (value == '') {
        return 0;
    }
    else {
        return value;
    }
}


function getDirect(table) {

    var rows = table.rows;

    _values = [];
    _allCols = table.headers[0];

    //Get array that represents title and numeric columns
    if(!colDefsComplete(_colDefs))
        _colDefs = getColumnTypes(table);

    //If we don't have complete column definitions, then go into 'counting' mode
    //In counting mode we count occurrences of the same value actross all cells and use bubbles to represent that
    if (!colDefsComplete(_colDefs)) {
        map = {};

        $.each(rows, function (row_index, row) {
            $.each(row, function (column_index, value) {
                if (map[value] == null) {
                    map[value] = 1;
                }
                else {
                    map[value]++;
                }
            });
        });

        var index = 0;
        $.each(map, function (key, value) {
            _values[index] = [];
            _values[index][0] = key;
            _values[index][1] = value;
            _values[index][2] = 0;
            index++;
        });
    }
    else {

        $.each(rows, function (row_index, row) {
            _values[row_index] = [];
            _values[row_index][0] = String(row[_colDefs.titleIndex]);
            _values[row_index][1] = convertBlankToDefault(row[_colDefs.sizeIndex]);
            if (_colDefs.colorIndex == -1) {
                _values[row_index][2] = 0;
            }
            else {
                _values[row_index][2] = convertBlankToDefault(row[_colDefs.colorIndex]);
            }
        });

    }

}

function getDetails(newPrimaryKey) {

    var filteredResults = [];

    _values = [];

    var headers = _detailData.headers[0];
    var detailDataIndex = 0;
    var detailGroupByIndex = 0;
    var dataColumnIndex = [];

    $.each(headers, function (i, header) {
        if (header == _primaryKey) {
            detailDataIndex = i;
        }
        else if (header == _groupBy) {
            detailGroupByIndex = i;
        }
        else if (IsNumeric(convertBlankToDefault(_detailData.rows[0][i]))) {
            dataColumnIndex.push(i);
        }
    }
    );

    var valuesIndex = 0;
    $.each(_detailData.rows, function (i, record) {
        if (record[detailDataIndex] == newPrimaryKey) {
            _values[valuesIndex] = ['', 0, 0, {}];
            _values[valuesIndex][0] = record[detailGroupByIndex];
            _values[valuesIndex][4] = [];
            $.each(dataColumnIndex, function (j, columnIndex) {
                _values[valuesIndex][3][headers[columnIndex]] = convertBlankToDefault(record[columnIndex]);
                _values[valuesIndex][4][j] = convertBlankToDefault(record[columnIndex]);
                if (IsNumeric(record[columnIndex])) {
                    _values[valuesIndex][1] += parseFloat(record[columnIndex]);
                    _values[valuesIndex][2] += parseFloat(record[columnIndex]);

                }
            }

            );
            valuesIndex++;

        }

    }
    );

    if (_values.length == 0) {
        myMessageBox.showErrorMessage("No details found for " + newPrimaryKey + ".");
    }
    else {
        myMessageBox.closePanel();
    }

}

//setup the initial values and then draw them
function initializeValues(result, forceRefresh) {
    var values = result.value;

    if (values == null || values.rows.length == 0) {
        myMessageBox.showErrorMessage("No data could be found.");
        return;
    }
    else if (values.headers.length == 0) {
        myMessageBox.showErrorMessage("No headers found in table.");
        return;
    }



    if (_bubblesMode == 'DIRECT') {
        getDirect(values)
    }
    else {
        if (_detailData == null || _detailData.rows[0].length == 0) {
            myMessageBox.showErrorMessage("Detail data could not be found.");
            return;
        }
        else if (_detailData.headers.length == 0) {
            myMessageBox.showErrorMessage("No headers found in detail table.");
            return;
        }

        var header = values.headers[0];

        //Set primary key index

        _primaryColumnIndex = -1;
        for (var i = 0; i < header.length; i++) {
            if (header[i] == _primaryKey) {
                _primaryColumnIndex = i;
                break;
            }
        }


        if (_primaryColumnIndex == -1) {
            myMessageBox.showErrorMessage("Could not find " + _primaryKey + " column.  Please change or select different data");
            return;
        }

        if (_currentSelectedRow == null) _currentSelectedRow = 0;

        var newSelectedPrimaryKey = values.rows[_currentSelectedRow][_primaryColumnIndex];

        if (newSelectedPrimaryKey == _selectedPrimaryKey && forceRefresh == false) {
            return;
        }

        getDetails(newSelectedPrimaryKey)
        _selectedPrimaryKey = newSelectedPrimaryKey;

    }

    //Display bubbles
    hideStartPage();
    showCanvas();
}


//function to save out the settings
function saveSettings() {
    ga("send", "event", "Actions", "SaveSettings");

    var bubblesModeBox = document.getElementById("bubblesMode");
    var primaryKeyBox = document.getElementById("primaryKey");
    var groupByBox = document.getElementById("groupBy");
    var minColorBox = document.getElementById("minColor");
    var maxColorBox = document.getElementById("maxColor");

    _bubblesMode = bubblesModeBox.value;
    _primaryKey = primaryKeyBox.value;
    _groupBy = groupByBox.value;
    _minValue = minColorBox.value;
    _maxValue = maxColorBox.value;


    var selectedItem;

    selectedItem = $("#titleCol option:selected");
    _colDefs.titleIndex = $("#titleCol").val();
    _colDefs.titleHeader = selectedItem.text();

    selectedItem = $("#sizeCol option:selected");
    _colDefs.sizeIndex = $("#sizeCol").val();
    _colDefs.sizeHeader = selectedItem.text();

    selectedItem = $("#colorCol option:selected");
    _colDefs.colorIndex = $("#colorCol").val();
    _colDefs.colorHeader = selectedItem.text();


    _settings.set("bubblesMode", _bubblesMode);
    _settings.set("primaryKey", _primaryKey);
    _settings.set("groupBy", _groupBy);
    _settings.set("minColor", _minValue);
    _settings.set("maxColor", _maxValue);
    _settings.set("colDefs", _colDefs);

    _settings.saveAsync();

    if (_detailDataBinding != null && _dataBinding != null) {
        refreshBubbles(_detailDataBinding, true);
    } else {
        if (_dataBinding != null)
            refreshBubbles(_dataBinding, true);
    }

    if (mySettingsBox) {
        mySettingsBox.closePanel();
    }




}

//hides the bubbles menu shown when nothing is bound yet
function hideStartPage() {
    var startPage = document.getElementById("startPage");
    if (startPage) {
        startPage.style.visibility = "hidden";
        var menu = Processing.getInstanceById('canvasMenu');
        menu.noLoop();
    }
}

//show the bubbles menu
function showStartPage() {
    ga("send", "event", "Actions", "ShowMenu");

    var startPage = document.getElementById("startPage");
    startPage.style.visibility = "visible";
    var menu = Processing.getInstanceById('canvasMenu');
    menu.setup();
    menu.loop();
}

function displaySettings() {
    ga("send", "event", "Actions", "ShowSettings");

    //load the html to use for the settings panel from the element with the id "mySettings"
    var dialogContent = $("#mySettings").html();

    //tell the settings box to display the html, with the title "Settings", modally, not to close automatically, and to use the Cog icon.
    mySettingsBox.showDialog(dialogContent, "img/MetroCog.png", "Settings", { autoClose: false, modal: true });

    //set the values of the various controls in the dialog to that of our settings object
    $("#bubblesMode").val(_bubblesMode);
    $("#minColor").val(_minValue);
    $("#maxColor").val(_maxValue);

    if (colDefsComplete(_colDefs)) {

        $("#titleCol").empty();
        $("#sizeCol").empty();
        $("#colorCol").empty();
        $.each(_allCols, function (index, value) {

            addHeaderOptions("#titleCol", value, _colDefs.titleHeader, index);
            addHeaderOptions("#sizeCol", value, _colDefs.sizeHeader, index);
            addHeaderOptions("#colorCol", value, _colDefs.colorHeader, index);
        });

    }
    changeMode();
    PopulatePrimaryKey();

}

function addHeaderOptions(selector, value, selectedValue, index) {
    var selected;
    if (value == selectedValue) {
        selected = ' selected="selected"';
    }
    else {
        selected = "";
    }
    var optionHtml = '<option value="' + index + '"' + selected + '>' + value + '</option>';


    $(selector).append(optionHtml);

}

var chartIsRendered = false; //at least one chart has been rendered by this Agave

//switches the drawn pane between the chart and the start page
function switchVisiblePane() {

    if (window.getComputedStyle(document.getElementById("startPage")).visibility == "hidden") {
        showStartPage();
        hideCanvas();
    }
    else if (chartIsRendered) {
        hideStartPage();
        showCanvas();
    }
}

//hides the canvas
function hideCanvas() {
    document.getElementById("myCanvas").style.visibility = "hidden";
}

//displays the canvas
function showCanvas() {
    if (document.getElementById("myCanvas")) {
        document.getElementById("myCanvas").style.visibility = "visible";
        var canvas = Processing.getInstanceById('canvasMain');
        canvas.setup();
        canvas.loop();
    }
}

//causes the settings button to appear when mouse enters the Agave
function bodyOnMouseOver() {
    if (chartIsRendered || (document.getElementById("startPage") && window.getComputedStyle(document.getElementById("startPage")).visibility == "hidden"))
        document.getElementById("backImageButton").style.opacity = .5;
}

//causes the settings button to disappear when mouse leaves the Agave
function bodyOnMouseOut() {
    document.getElementById("backImageButton").style.opacity = 0;
}

function insertSampleData() {
    ga("send", "event", "Actions", "InsertSampleData");
    sampleRows = [['Seattle', 20, 25], ['New York', 30, 35], ['Chicago', 10, 40], ['Texas', 40, 10], ['Boston', 25, 25], ['Los Angeles', 10, 15]];
    sampleHeaders = [['Title', 'Bubble Size', 'Bubble Color']];
    sampleData = new Office.TableData(sampleRows, sampleHeaders);
    _OM.setSelectedDataAsync(
            sampleData,
            function (asyncResult) {
                if (asyncResult.status == Office.AsyncResultStatus.Failed) {
                        myMessageBox.showErrorMessage("Sample data could not be inserted in the current location. Please try selecting a different location.");
                }
                else {
                    //Reset column mappings as this is a new binding
                    _colDefs = {};
                    //Bind to the sample data
                    _OM.bindings.addFromSelectionAsync(Office.BindingType.Table,
     {
         id: "Data"
     },
     function (asyncResult) {
         if (asyncResult.status == Office.AsyncResultStatus.Succeeded) {
             _dataBinding = asyncResult.value;
             getBindingValues(asyncResult.value);
         }
     }
 );
                }
            }

        );

}

function insertSampleDetailData() {
    ga("send", "event", "Actions", "InsertDetailedSampleData");

    sampleRows = [['Seattle', 'A', 0, 1, 1], ['Seattle', 'B', 0, 0, 1], ['New York', 'A', 1, 0, 0], ['Chicago', 'A', 2, 0, 2], ['Texas', 'C', 2, 0, 2], ['Boston', 'A', 2, 0, 2], ['Los Angeles', 'B', 2, 0, 2], ['Los Angeles', 'C', 2, 0, 2]];
    sampleHeaders = [['Title', 'Group', 'Value A', 'Value B', 'Value C']];
    sampleData = new Office.TableData(sampleRows, sampleHeaders);
    _OM.setSelectedDataAsync(
            sampleData,
            function (asyncResult) {
                if (asyncResult.status == Office.AsyncResultStatus.Failed) {
                    myMessageBox.showErrorMessage("Not enough space.  Please select a different area.");
                }
            }
        );
}

//occurs when hovering over the 'Select Chart Data' button
function startDataOver() {
    document.getElementById("startDataID").innerHTML = "Draw Chart Based On Current Selection";
    document.getElementById("startDataID").style.color = "black";
    document.getElementById("createTreeMapIcon").style.visibility = "hidden";
    document.getElementById("startDataButton").style.backgroundColor = "#dfdfdf";
    document.getElementById("startDataID").style.color = "black";
}

//occurs when hovering over the 'Example Data' button
function demoOver() {
    document.getElementById("demoID").innerHTML = "Insert Example Data Into Current Cell Selection";
    document.getElementById("demoIcon").style.visibility = "hidden";
    document.getElementById("demoID").style.color = "black";
}

//occurs when hovering over the 'Settings' button
function settingsOver() {
    document.getElementById("settingsID").innerHTML = "Settings";
    document.getElementById("settingsIcon").style.visibility = "hidden";
}

//occurs when leaving the 'Select Chart Data' button
function startDataOut() {
    if (window.getComputedStyle(document.getElementById("startPage")).visibility == "visible") {
        document.getElementById("startDataID").innerHTML = "Select Chart Data";
        document.getElementById("createTreeMapIcon").style.visibility = "visible";
        document.getElementById("startDataID").style.color = "white";

        if (document.getElementById("startDataButton")) {
            document.getElementById("startDataButton").style.backgroundColor = "#227346";
        }
    }
}

//occurs when leaving the 'Example Data' button
function demoOut() {
    if (window.getComputedStyle(document.getElementById("startPage")).visibility == "visible") {
        document.getElementById("demoID").innerHTML = "Example Data";
        document.getElementById("demoIcon").style.visibility = "visible";
        document.getElementById("demoID").style.color = "white";
    }
}

//occurs when leaving the 'Settings' button
function settingsOut() {
    if (window.getComputedStyle(document.getElementById("startPage")).visibility == "visible") {
        document.getElementById("settingsID").innerHTML = "Settings";
        document.getElementById("settingsIcon").style.visibility = "visible";
    }
}

function changeMode() {
    if (document.getElementById("bubblesMode").value == "DETAIL") {
        $(".bindingDetailData").fadeIn('fast');
    }
    else {
        $(".bindingDetailData").fadeOut('fast');
    }

}

function showDetails(id) {
    var data = "";
    $("#detailsHeading").html(_values[id][0] + " Details");
    $.each(_values[id][3], function (name, value) {
        data += "<tr><td>" + name + "</td><td>" + value + "</td></tr>";
    }
    );
    $("#detailsBox tbody").html(data);
    $("#detailsBox").fadeIn("fast");

}

function hideDetails() {
    $("#detailsBox").fadeOut("fast");
}

