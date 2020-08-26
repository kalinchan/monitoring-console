/*
   DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER.
  
   Copyright (c) 2019-2020 Payara Foundation and/or its affiliates. All rights reserved.
  
   The contents of this file are subject to the terms of either the GNU
   General Public License Version 2 only ("GPL") or the Common Development
   and Distribution License("CDDL") (collectively, the "License").  You
   may not use this file except in compliance with the License.  You can
   obtain a copy of the License at
   https://github.com/payara/Payara/blob/master/LICENSE.txt
   See the License for the specific
   language governing permissions and limitations under the License.
  
   When distributing the software, include this License Header Notice in each
   file and include the License file at glassfish/legal/LICENSE.txt.
  
   GPL Classpath Exception:
   The Payara Foundation designates this particular file as subject to the "Classpath"
   exception as provided by the Payara Foundation in the GPL Version 2 section of the License
   file that accompanied this code.
  
   Modifications:
   If applicable, add the following below the License Header, with the fields
   enclosed by brackets [] replaced by your own identifying information:
   "Portions Copyright [year] [name of copyright owner]"
  
   Contributor(s):
   If you wish your version of this file to be governed by only the CDDL or
   only the GPL Version 2, indicate your decision by adding "[Contributor]
   elects to include this software in this distribution under the [CDDL or GPL
   Version 2] license."  If you don't indicate a single choice of license, a
   recipient has the option to distribute your version of this file under
   either the CDDL, the GPL Version 2 or to extend the choice of license to
   its licensees as provided above.  However, if you add GPL Version 2 code
   and therefore, elected the GPL Version 2 license, then the option applies
   only if the new code is made subject to such option by the copyright
   holder.
*/

/*jshint esversion: 8 */

/**
 * Main API to update or manipulate the view of the generic page.
 **/
MonitoringConsole.View = (function() {

    const Controller = MonitoringConsole.Controller;
    const Components = MonitoringConsole.View.Components;
    const Units = MonitoringConsole.View.Units;
    const Colors = MonitoringConsole.View.Colors;
    const Theme = MonitoringConsole.Model.Theme;

    /**
     * Updates the DOM with the page navigation tabs so it reflects current model state
     */ 
    function updatePageNavigation() {
        const Navigation = MonitoringConsole.Model.Settings.Navigation;
        let panelConsole = $('#console');
        if (Navigation.isCollapsed()) {
            panelConsole.removeClass('state-show-nav');
        } else {
            if (!panelConsole.hasClass('state-show-nav')) {
                panelConsole.addClass('state-show-nav');                
            }
        }
        $('#NavSidebar').replaceWith(Components.createNavSidebar(createNavSidebarModel()));
    }

    /**
     * Updates the DOM with the page and selection settings so it reflects current model state
     */ 
    function updateSettings() {
        const panelConsole = $('#console');
        const collapsed = !MonitoringConsole.Model.Settings.isDispayed();
        let groups = [];
        if (collapsed) {
            panelConsole.removeClass('state-show-settings');
        } else {
            if (!panelConsole.hasClass('state-show-settings')) {
                panelConsole.addClass('state-show-settings');                
            }
            let singleSelection = MonitoringConsole.Model.Page.Widgets.Selection.isSingle();
            groups.push(createGlobalSettings(singleSelection));
            groups.push(createColorSettings());
            groups.push(createPageSettings());
            if (singleSelection)
                groups = groups.concat(createWidgetSettings(MonitoringConsole.Model.Page.Widgets.Selection.first()));
        }
        $('#Settings').replaceWith(Components.createSettings({
            id: 'Settings', 
            collapsed: collapsed,            
            groups: groups,
            onSidebarToggle: () => {
                MonitoringConsole.Model.Settings.toggle();
                updateSettings();
            },
            onWidgetAdd: showAddWidgetModalDialog,
        }));
    }


    function updateDomOfWidget(parent, widget) {
        if (!parent) {
            parent = $('#widget-'+widget.target);
            if (!parent) {
                return; // can't update
            }
        }
        if (parent.children().length == 0) {
            let previousParent = $('#widget-'+widget.target);
            if (previousParent.length > 0 && previousParent.children().length > 0) {
                previousParent.children().appendTo(parent);
            } else {
                parent.append(Components.createWidgetHeader(createWidgetHeaderModel(widget)));
                parent.append(createWidgetTargetContainer(widget));
                parent.append(Components.createAlertTable({}));
                parent.append(Components.createAnnotationTable({}));
                parent.append(Components.createLegend([]));                
                parent.append(Components.createIndicator({}));
            }
        }
        if (widget.selected) {
            parent.addClass('chart-selected');
        } else {
            parent.removeClass('chart-selected');
        }
    }

    /**
     * Each chart needs to be in a relative positioned box to allow responsive sizing.
     * This fuction creates this box including the canvas element the chart is drawn upon.
     */
    function createWidgetTargetContainer(widget) {
        return $('<div/>', { id: widget.target + '-box', "class": "widget-chart-box" })
            .append($('<canvas/>',{ id: widget.target }));
    }

    function createWidgetHeaderModel(widget) {
        function toWords(str) {
            // camel case to words
            let res = str.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1");
            if (res.indexOf('.') > 0) {
                // dots to words with upper casing each word
                return res.replace(/\.([a-z])/g, " $1").split(' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
            }
            return res;
        }

        function metricName(series) {
            let start = series.indexOf(' ') + 1;
            let groupStart = series.indexOf('@:') + 1;
            if (groupStart > start)
                start = groupStart + 1;
            return series.substring(start);
        }

        const Widgets = MonitoringConsole.Model.Page.Widgets;
        const series = widget.series;
        let title = widget.displayName;
        if (title == '' || title === undefined) {
            if (Array.isArray(series)) {
                title = series.map(e => toWords(metricName(e))).join(', ');
            } else {
                title = toWords(metricName(series));        
            }
        } 
        let description = widget.description;
        if (description == '' || description === undefined) {
            if (Array.isArray(series)) {
                description = series.join(', ');
            } else {
                description = series;
            }
        }
        return {
            id: 'WidgetHeader-' + widget.target,
            title: title,
            description:  description,
            selected: () => MonitoringConsole.Model.Page.Widgets.Selection.listSeries().indexOf(widget.id) >= 0,
            onClick: () => {
                Widgets.Selection.toggle(widget.id, true);
                updateSettings();
            },

        };
    }

    function createGlobalSettings(initiallyCollapsed) {
        const pushAvailable = MonitoringConsole.Model.Role.isAdmin();
        const pullAvailable = !MonitoringConsole.Model.Role.isGuest();
        const watchesAvailable = !MonitoringConsole.Model.Role.isGuest();
        return { id: 'settings-global', type: 'app', caption: 'General', collapsed: initiallyCollapsed, entries: [
            { label: 'Import', input: () => $('<button />', { text: 'Import Configuration...'}).click(() => $('#cfgImport').click()) },
            { label: 'Export', input: () => $('<button />', { text: 'Export Configuration...'}).click(MonitoringConsole.View.onPageExport) },
            { label: 'Data Refresh', input: [
                { type: 'value', unit: 'sec', value: MonitoringConsole.Model.Refresh.interval(), onChange: (val) => MonitoringConsole.Model.Refresh.interval(val) },
                { type: 'toggle', options: { false: 'Pause', true: 'Play'}, value: !MonitoringConsole.Model.Refresh.isPaused(), onChange: (checked) => MonitoringConsole.Model.Refresh.paused(!checked) },
            ]},
            { label: 'Page Rotation', input: [
                { type: 'value', unit: 'sec', value: MonitoringConsole.Model.Settings.Rotation.interval(), onChange: (val) => MonitoringConsole.Model.Settings.Rotation.interval(val) },
                { type: 'toggle', options: { false: 'Off', true: 'On' }, value: MonitoringConsole.Model.Settings.Rotation.isEnabled(), onChange: (checked) => MonitoringConsole.Model.Settings.Rotation.enabled(checked) },
            ]},
            { label: 'Role', input: () => $('<button />').text(MonitoringConsole.Model.Role.name() + '...').click(showRoleSelectionModalDialog) },
            { label: 'Page Sync', available: pushAvailable || pullAvailable, input: [
                { available: pushAvailable, input: () => $('<button />', { text: 'Push All Local Pages...', title: 'Push local state of all know remote pages to server'}).click(showPagePushModalDialog) },
                { available: pullAvailable, input: () => $('<button/>', { text: 'Manage Local Pages...', title: 'Open Page synchronisation dialoge'}).click(showPageSyncModalDialog) }, 
            ]},
            { label: 'Watches', available: watchesAvailable, input: $('<button/>').text('Manage Watches...').click(showWatchConfigModalDialog) },
        ]};
    }

    function createColorSettings() {
        function createChangeColorDefaultFn(name) {
            return (color) => { Theme.configure(theme => theme.colors[name] = color); updateSettings(); };
        }
        function createChangeOptionFn(name) {
            return (value) => { Theme.configure(theme => theme.options[name] = value); };
        }    
        function createColorDefaultSettingMapper(name) {
            let label = Units.Alerts.name(name);
            if (label === undefined)
                label = name[0].toUpperCase() + name.slice(1);
            return { label: label, type: 'color', value: Theme.color(name), onChange: createChangeColorDefaultFn(name) };
        }
        let collapsed = $('#settings-colors').children('tr:visible').length <= 1;
        return { id: 'settings-colors', type: 'app', caption: 'Colors', collapsed: collapsed, entries: [
            { label: 'Scheme', type: 'dropdown', options: Colors.schemes(), value: undefined, onChange: (name) => { Colors.scheme(name); updateSettings(); } },
            { label: 'Data #', type: 'color', value: Theme.palette(), onChange: (colors) => Theme.palette(colors) },
            { label: 'Defaults', input: [
                ['error', 'missing'].map(createColorDefaultSettingMapper),
                ['alarming', 'critical', 'waterline'].map(createColorDefaultSettingMapper),
                ['white', 'green', 'amber', 'red'].map(createColorDefaultSettingMapper)]},
            { label: 'Opacity', description: 'Fill transparency 0-100%', input: [
                { type: 'value', unit: 'percent', value: Theme.option('opacity'), onChange: createChangeOptionFn('opacity') },
            ]},
            { label: 'Thickness', description: 'Line thickness 1-8 (each step is equivalent to 0.5px)', input: [
                { type: 'range', min: 1, max: 8, value: Theme.option('line-width'), onChange: createChangeOptionFn('line-width') },
            ]},
        ]};
    }

    function createWidgetSettings(widget) {
        function changeSeries(selectedSeries) {
            if (selectedSeries !== undefined && selectedSeries.length > 0)
                onPageChange(MonitoringConsole.Model.Page.Widgets.configure(widget.id, 
                    widget => widget.series = selectedSeries.length == 1 ? selectedSeries[0] : selectedSeries));
        }
        let seriesInput = $('<span/>');
        if (Array.isArray(widget.series)) {
            seriesInput.append(widget.series.join(', ')).append(' ');                    
        } else {
            seriesInput.append(widget.series).append(' ');
        }
        seriesInput.append($('<br/>')).append($('<button/>', { text: 'Change metric(s)...' })
                .click(() => showModalDialog(createWizardModalDialogModel(widget.series, changeSeries))));
        let options = widget.options;
        let unit = widget.unit;
        let thresholds = widget.decorations.thresholds;
        let settings = [];
        let collapsed = $('#settings-widget').children('tr:visible').length <= 1;
        let typeOptions = { line: 'Time Curve', bar: 'Range Indicator', alert: 'Alerts', annotation: 'Annotations', rag: 'RAG Status' };
        let modeOptions = widget.type == 'annotation' ? { table: 'Table', list: 'List' } : { list: '(Default)' };
        settings.push({ id: 'settings-widget', caption: 'Widget', collapsed: collapsed, entries: [
            { label: 'Display Name', type: 'text', value: widget.displayName, onChange: (widget, value) => widget.displayName = value},
            { label: 'Type', type: 'dropdown', options: typeOptions, value: widget.type, onChange: (widget, selected) => widget.type = selected},
            { label: 'Mode', type: 'dropdown', options: modeOptions, value: widget.mode, onChange: (widget, selected) => widget.mode = selected},
            { label: 'Column / Item', input: [
                { type: 'range', min: 1, max: 4, value: 1 + (widget.grid.column || 0), onChange: (widget, value) => widget.grid.column = value - 1},
                { type: 'range', min: 1, max: 8, value: 1 + (widget.grid.item || 0), onChange: (widget, value) => widget.grid.item = value - 1},
            ]},             
            { label: 'Size', input: [
                { label: '&nbsp;x', type: 'range', min: 1, max: 4, value: widget.grid.colspan || 1, onChange: (widget, value) => widget.grid.colspan = value},
                { type: 'range', min: 1, max: 4, value: widget.grid.rowspan || 1, onChange: (widget, value) => widget.grid.rowspan = value},
            ]},
            { label: 'Actions', input: $('<button/>').text('Remove Widget').click(() => onWidgetDelete(widget)) },
        ]});
        settings.push({ id: 'settings-data', caption: 'Data', entries: [
            { label: 'Series', input: seriesInput },
            { label: 'Unit', input: [
                { type: 'dropdown', options: Units.names(), value: widget.unit, onChange: function(widget, selected) { widget.unit = selected; updateSettings(); }},
                { label: '1/sec', type: 'checkbox', value: options.perSec, onChange: (widget, checked) => widget.options.perSec = checked},
            ]},
            { label: 'Upscaling', description: 'Upscaling is sometimes needed to convert the original value range to a more user freindly display value range', input: [
                { type: 'range', min: 1, value: widget.scaleFactor, onChange: (widget, value) => widget.scaleFactor = value, 
                    description: 'A factor multiplied with each value to upscale original values in a graph, e.g. to move a range 0-1 to 0-100%'},
                { label: 'decimal value', type: 'checkbox', value: options.decimalMetric, onChange: (widget, checked) => widget.options.decimalMetric = checked,
                    description: 'Values that are collected as decimal are converted to a integer with 4 fix decimal places. By checking this option this conversion is reversed to get back the original decimal range.'},
            ]},
            { label: 'Extra Lines', input: [
                { label: 'Min', type: 'checkbox', value: options.drawMinLine, onChange: (widget, checked) => widget.options.drawMinLine = checked},
                { label: 'Max', type: 'checkbox', value: options.drawMaxLine, onChange: (widget, checked) => widget.options.drawMaxLine = checked},
                { label: 'Avg', type: 'checkbox', value: options.drawAvgLine, onChange: (widget, checked) => widget.options.drawAvgLine = checked},            
            ]},
            { label: 'Lines', input: [
                { label: 'Points', type: 'checkbox', value: options.drawPoints, onChange: (widget, checked) => widget.options.drawPoints = checked},
                { label: 'Curvy', type: 'checkbox', value: options.drawCurves, onChange: (widget, checked) => widget.options.drawCurves = checked},
            ]},
            { label: 'Background', input: [
                { label: 'Fill', type: 'checkbox', value: !options.noFill, onChange: (widget, checked) => widget.options.noFill = !checked},
            ]},
            { label: 'X-Axis', input: [
                { label: 'Labels', type: 'checkbox', value: !options.noTimeLabels, onChange: (widget, checked) => widget.options.noTimeLabels = !checked},
            ]},            
            { label: 'Y-Axis', input: [
                { label: 'Min', type: 'value', unit: unit, value: widget.axis.min, onChange: (widget, value) => widget.axis.min = value},
                { label: 'Max', type: 'value', unit: unit, value: widget.axis.max, onChange: (widget, value) => widget.axis.max = value},
            ]},
            { label: 'Coloring', type: 'dropdown', options: { instance: 'Instance Name', series: 'Series Name', index: 'Result Set Index', 'instance-series': 'Instance and Series Name' }, value: widget.coloring, onChange: (widget, value) => widget.coloring = value,
                description: 'What value is used to select the index from the color palette' },
            { label: 'Fields', type: 'text', value: (widget.fields || []).join(' '), onChange: (widget, value) => widget.fields = value == undefined || value == '' ? undefined : value.split(/[ ,]+/),
                description: 'Selection and order of annotation fields to display, empty for auto selection and default order' },
            {label: 'Annotations', type: 'checkbox', value: !options.noAnnotations, onChange: (widget, checked) => widget.options.noAnnotations = !checked}                
        ]});
        settings.push({ id: 'settings-decorations', caption: 'Decorations', entries: [
            { label: 'Waterline', input: [
                { type: 'value', unit: unit, value: widget.decorations.waterline.value, onChange: (widget, value) => widget.decorations.waterline.value = value },
                { type: 'color', value: widget.decorations.waterline.color, defaultValue: Theme.color('waterline'), onChange: (widget, value) => widget.decorations.waterline.color = value },
            ]},
            { label: 'Alarming Threshold', input: [
                { type: 'value', unit: unit, value: thresholds.alarming.value, onChange: (widget, value) => widget.decorations.thresholds.alarming.value = value },
                { type: 'color', value: thresholds.alarming.color, defaultValue: Theme.color('alarming'), onChange: (widget, value) => thresholds.alarming.color = value },
                { label: 'Line', type: 'checkbox', value: thresholds.alarming.display, onChange: (widget, checked) => thresholds.alarming.display = checked },
            ]},
            { label: 'Critical Threshold', input: [
                { type: 'value', unit: unit, value: thresholds.critical.value, onChange: (widget, value) => widget.decorations.thresholds.critical.value = value },
                { type: 'color', value: thresholds.critical.color, defaultValue: Theme.color('critical'), onChange: (widget, value) => widget.decorations.thresholds.critical.color = value },
                { label: 'Line', type: 'checkbox', value: thresholds.critical.display, onChange: (widget, checked) => widget.decorations.thresholds.critical.display = checked },
            ]},                
            { label: 'Threshold Reference', type: 'dropdown', options: { off: 'Off', now: 'Most Recent Value', min: 'Minimum Value', max: 'Maximum Value', avg: 'Average Value'}, value: thresholds.reference, onChange: (widget, selected) => widget.decorations.thresholds.reference = selected},
        ]});
        settings.push({ id: 'settings-status', caption: 'Status', collapsed: true, description: 'Set a text for an assessment status', entries: [
            { label: '"No Data"', type: 'text', value: widget.status.missing.hint, onChange: (widget, text) => widget.status.missing.hint = text},
            { label: '"Alaraming"', type: 'text', value: widget.status.alarming.hint, onChange: (widget, text) => widget.status.alarming.hint = text},
            { label: '"Critical"', type: 'text', value: widget.status.critical.hint, onChange: (widget, text) => widget.status.critical.hint = text},
        ]});
        let alerts = widget.decorations.alerts;
        settings.push({ id: 'settings-alerts', caption: 'Alerts', collapsed: true, entries: [
            { label: 'Filter', input: [
                [
                    { label: 'Ambers', type: 'checkbox', value: alerts.noAmber, onChange: (widget, checked) => widget.decorations.alerts.noAmber = checked},
                    { label: 'Reds', type: 'checkbox', value: alerts.noRed, onChange: (widget, checked) => widget.decorations.alerts.noRed = checked},
                ],            
                [
                    { label: 'Ongoing', type: 'checkbox', value: alerts.noOngoing, onChange: (widget, checked) => widget.decorations.alerts.noOngoing = checked},
                    { label: 'Stopped', type: 'checkbox', value: alerts.noStopped, onChange: (widget, checked) => widget.decorations.alerts.noStopped = checked},
                ],
                [
                    { label: 'Acknowledged', type: 'checkbox', value: alerts.noAcknowledged, onChange: (widget, checked) => widget.decorations.alerts.noAcknowledged = checked},
                    { label: 'Unacknowledged', type: 'checkbox', value: alerts.noUnacknowledged, onChange: (widget, checked) => widget.decorations.alerts.noUnacknowledged = checked},
                ],
            ], description: 'Properties of alerts to show. Graphs hide stopped or acknowledged alerts automatically.' },
        ]});
        return settings;       
    }

    function createPageSettings() {

        function showIfRemotePageExists(jQuery) {
            Controller.requestListOfRemotePageNames((pageIds) => { // OBS: this asynchronously makes the button visible
                if (pageIds.indexOf(MonitoringConsole.Model.Page.id()) >= 0) {
                    jQuery.show();
                }
            });                        
            return jQuery;
        }

        const addWidgetsInput = $('<button/>', { text: 'Select metric(s)...' }).click(showAddWidgetModalDialog);
        let collapsed = $('#settings-page').children('tr:visible').length <= 1;
        let pushAvailable = !MonitoringConsole.Model.Role.isGuest() && MonitoringConsole.Model.Page.Sync.isLocallyChanged() && MonitoringConsole.Model.Role.isAdmin();
        let pullAvailable = !MonitoringConsole.Model.Role.isGuest();
        let autoAvailable = MonitoringConsole.Model.Role.isAdmin();
        let page = MonitoringConsole.Model.Page.current();
        let queryAvailable = page.type === 'query';
        const configure =  MonitoringConsole.Model.Page.configure;
        return { id: 'settings-page', type: 'page', caption: 'Page', collapsed: collapsed, entries: [
            { label: 'Include in Rotation', type: 'toggle', options: { false: 'No', true: 'Yes' }, value: MonitoringConsole.Model.Page.rotate(), onChange: (checked) => MonitoringConsole.Model.Page.rotate(checked) },
            { label: 'Type', type: 'dropdown', options: {manual: 'Manual', query: 'Query'}, value: page.type, onChange: (type) => { onPageUpdate(configure(page => page.type = type)); updateSettings(); } },            
            { label: 'Max Size', available: queryAvailable, type: 'value', min: 1, unit: 'count', value: page.content.maxSize,  onChange: (value) => configure(page => page.content.maxSize = value) },
            { label: 'Query Series', available: queryAvailable, type: 'text', value: page.content.series, onChange: (value) => configure(page => page.content.series = value) },
            { label: 'Query Interval', available: queryAvailable, input: [
                { type: 'value', min: 1, unit: 'sec', value: page.content.ttl, onChange: (value) => configure(page => page.content.ttl = value) },
                { input: $('<button/>', {text: 'Update'}).click(() => configure(page => page.content.expires = undefined)) },
            ]},
            { label: 'Add Widgets', available: !queryAvailable, input: addWidgetsInput },
            { label: 'Sync', available: pushAvailable || pullAvailable, input: [
                { available: autoAvailable, label: 'auto', type: 'checkbox', value: MonitoringConsole.Model.Page.Sync.auto(), onChange: (checked) => MonitoringConsole.Model.Page.Sync.auto(checked),
                    description: 'When checked changed to the page are automatically pushed to the remote server (shared with others)' },
                { available: pushAvailable, input: () => $('<button />', { text: 'Push', title: 'Push local page to server (update remote)' }).click(onPagePush) },
                { available: pullAvailable, input: () => showIfRemotePageExists($('<button />', { text: 'Pull', title: 'Pull remote page from server (update local)', style: 'display: none'}).click(onPagePull)) },
            ]}
        ]};
    }

    function createConfirmModualDialog(question, labelYes, labelNo, onConfirmation) {
        return {
            width: 300,
            top: 200,
            content: () => $('<p/>').html(question),
            buttons: [
                { property: 'no', label: labelNo, secondary: true },
                { property: 'yes', label: labelYes },
            ],
            results: { yes: true, no: false },
            onExit: result => {
                if (result)
                    onConfirmation();
            }
        };
    }

    function showAddWidgetModalDialog() {
        showModalDialog(createWizardModalDialogModel([], selectedSeries => {
                if (selectedSeries !== undefined && selectedSeries.length > 0)
                    onPageChange(MonitoringConsole.Model.Page.Widgets.add(selectedSeries));
        }));
    }

    function showModalDialog(model) {
        $('#ModalDialog').replaceWith(Components.createModalDialog(model));
    }

    function showFeedback(model) {
        const banner = Components.createFeedbackBanner(model);
        $('#FeedbackBannerContainer').append(banner);
        banner.delay(3000).fadeOut();
    }


    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[ Event Handlers ]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    function onWidgetDelete(widget) {
        const description = Array.isArray(widget.series)
            ? widget.series.join(', ')
            : widget.series;
        const question = 'Do you really want to remove the widget with metric series <code>'+ description + '</code> from the page?';
        showModalDialog(createConfirmModualDialog(question, 'Remove', 'Cancel', () =>  {
            onPageChange(MonitoringConsole.Model.Page.Widgets.remove(widget.id));
            showFeedback({ type: 'success', message: 'Widget ' + description + ' removed.'});
        }));
    }

    function onPageExport(filename, text) {
        let pom = document.createElement('a');
        pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        pom.setAttribute('download', filename);

        if (document.createEvent) {
            let event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            pom.dispatchEvent(event);
        }
        else {
            pom.click();
        }
    }

    function createLegendModel(widget, data, alerts, annotations) {
        if (!data)
            return [{ label: 'Connection Lost', value: '?', color: 'red', assessments: { status: 'error' } }];
        if (widget.type == 'alert')
            return createLegendModelFromAlerts(widget, alerts);
        if (widget.type == 'annotation')
            return createLegendModelFromAnnotations(widget, annotations);
        if (Array.isArray(data) && data.length == 0)
            return [{ label: 'No Data', value: '?', color: '#0096D6', assessments: {status: 'missing' }}];
        let legend = [];
        let format = Units.converter(widget.unit).format;
        let palette = Theme.palette();
        let alpha = Theme.option('opacity') / 100;
        for (let j = 0; j < data.length; j++) {
            const seriesData = data[j];
            const series = widget.series;
            const isMultiSeries = Array.isArray(series) && series.length > 1;
            let label = seriesData.instance;
            if (isMultiSeries)
                label += ': ' + seriesData.series.split(" ").pop();
            if (!isMultiSeries && series.includes('*') && !series.includes('?')) {
                let tag = seriesData.series.replace(new RegExp(series.replace('*', '(.*)')), '$1').replace('_', ' ');                
                label = widget.coloring == 'series' ? tag : [label, tag];
            }
            let points = seriesData.points;
            let avgOffN = widget.options.perSec ? Math.min(points.length / 2, 4) : 1;
            let avg = 0;
            for (let n = 0; n < avgOffN; n++)
                avg += points[points.length - 1 - (n * 2)];
            avg /= avgOffN;
            let value = format(avg, widget.unit === 'bytes' || widget.unit === 'ns');
            if (widget.options.perSec)
                value += ' /s';
            let coloring = widget.coloring;
            let color = Colors.lookup(coloring, getColorKey(widget, seriesData.series, seriesData.instance, j), palette);
            let background = Colors.hex2rgba(color, alpha);
            if (Array.isArray(alerts) && alerts.length > 0) {
                let level;
                for (let i = 0; i < alerts.length; i++) {
                    let alert = alerts[i];
                    if (alert.instance == seriesData.instance && alert.series == seriesData.series && !alert.stopped) {
                        level = Units.Alerts.maxLevel(level, alert.level);
                    }
                }
                if (level == 'red' || level == 'amber') {
                    background = Colors.hex2rgba(Theme.color(level), Math.min(1, alpha * 2));
                }
            }
            let status = seriesData.assessments.status;
            let highlight = status === undefined ? undefined : Theme.color(status);
            let item = { 
                label: label, 
                value: value, 
                color: color,
                background: background,
                status: status,
                highlight: highlight,
            };
            legend.push(item);
            seriesData.legend = item;
        }
        return legend;
    }

    function createLegendModelFromAlerts(widget, alerts) {
        if (!Array.isArray(alerts))
            return []; //TODO use white, green, amber and red to describe the watch in case of single watch
        let palette = Theme.palette();
        let alpha = Theme.option('opacity') / 100;
        let instances = {};
        for (let alert of alerts) {
            instances[alert.instance] = Units.Alerts.maxLevel(alert.level, instances[alert.instance]);
        }
        
        return Object.entries(instances).map(function([instance, level]) {
            let color = Colors.lookup('instance', instance, palette);
            return {
                label: instance,
                value: Units.Alerts.name(level),
                color: color,
                background: Colors.hex2rgba(color, alpha),
                status: level, 
                highlight: Theme.color(level),                
            };
        });
    }

    function createLegendModelFromAnnotations(widget, annotations) {
        let coloring = widget.coloring || 'instance';
        if (!Array.isArray(annotations) || coloring === 'index')
            return [];
        let palette = Theme.palette();
        let entries = {};
        let index = 1;
        for (let annotation of annotations) {
            let series = annotation.series;
            let instance = annotation.instance;
            let label = coloring === 'series' ? [series] : coloring === 'instance' ? [instance] : [instance, series];
            let key = label.join('-');
            let entry = entries[key];
            if (entry === undefined) {
                let colorKey = getColorKey(widget, series, instance, index);
                entries[key] = { label: label, count: 1, color: Colors.lookup(coloring, colorKey, palette) };
            } else {
                entry.count += 1;
            }
            index++;
        }
        return Object.values(entries).map(function(entry) {
            return {
                label: entry.label,
                value: entry.count + 'x',
                color: entry.color,                
            };
        });
    }

    function getColorKey(widget, series, instance, index) {
        switch (widget.coloring) {
            case 'index': return 'line-' + index;
            case 'series': return series;
            case 'instance-series': return instance + ' ' + series;
            case 'instance': 
            default: return instance;
        }
    } 

    function createIndicatorModel(widget, data) {
        if (!data)
            return { status: 'error', color: Theme.color('error') };
        if (Array.isArray(data) && data.length == 0)
            return { status: 'missing', color: Theme.color('missing'), text: widget.status.missing.hint };
        let status = 'normal';
        for (let seriesData of data)
            status = Units.Alerts.maxLevel(status, seriesData.assessments.status);
        const infoKey = status == 'red' ? 'critical' : status == 'amber' ? 'alarming' : status;
        let statusInfo = widget.status[infoKey] || {};
        return { status: status, color: Theme.color(status), text: statusInfo.hint };
    }

    function createRAGIndicatorModel(widget, legend) {
        const items = [];
        for (let item of legend) {
            items.push({
                label: item.label,
                status: item.status,
                state: item.value,
                color: item.color,
                background: item.highlight,
            });
        }
        return { items: items };
    }

    function createAlertTableModel(widget, alerts, annotations) {
        if (widget.type === 'annotation')
            return {};
        function createAlertAnnotationsFilter(alert) {
          return (annotation) => widget.options.noAnnotations !== true
                && annotation.series == alert.series 
                && annotation.instance == alert.instance
                && Math.round(annotation.time / 1000) >= Math.round(alert.since / 1000) // only same second needed
                && annotation.time <= (alert.until || new Date().getTime());  
        }
        let items = [];
        if (Array.isArray(alerts)) {
            let palette = Theme.palette();
            let fields = widget.fields;
            for (let i = 0; i < alerts.length; i++) {
                let alert = alerts[i];
                let autoInclude = widget.type === 'alert' || ((alert.level === 'red' || alert.level === 'amber') && !alert.acknowledged);
                let filters = widget.decorations.alerts;
                let lastAlertLevel = alert.frames[alert.frames.length - 1].level;
                if (lastAlertLevel == 'green' || lastAlertLevel == 'white')
                    lastAlertLevel = alert.frames[alert.frames.length - 2].level;
                let visible = (alert.acknowledged && filters.noAcknowledged !== true || !alert.acknowledged && filters.noUnacknowledged !== true)
                           && (alert.stopped && filters.noStopped !== true || !alert.stopped && filters.noOngoing !== true)
                           && (lastAlertLevel == 'red' && filters.noRed !== true || lastAlertLevel == 'amber' && filters.noAmber !== true);                  
                if (autoInclude && visible) {
                    let frames = alert.frames.map(function(frame) {
                        return {
                            level: frame.level,
                            since: frame.start,
                            until: frame.end,
                            color: Theme.color(frame.level),
                        };
                    });
                    let instanceColoring = widget.coloring === 'instance' || widget.coloring === undefined;
                    items.push({
                        serial: alert.serial,
                        name: alert.initiator.name,
                        unit: alert.initiator.unit,
                        acknowledged: alert.acknowledged,
                        series: alert.series == widget.series ? undefined : alert.series,
                        instance: alert.instance,
                        color: instanceColoring ? Colors.lookup('instance', alert.instance, palette) : undefined,
                        frames: frames,
                        watch: alert.initiator,
                        annotations: annotations.filter(createAlertAnnotationsFilter(alert)).map(function(annotation) {
                            return {
                                time: annotation.time,
                                value: annotation.value,
                                attrs: annotation.attrs,
                                fields: fields,
                            };
                        }),
                    });
                }
            }
        }
        return { id: widget.target + '_alerts', verbose: widget.type === 'alert', items: items };
    }

    function createAnnotationTableModel(widget, annotations) {
        if (widget.type !== 'annotation')
            return {};
        let items = [];
        if (Array.isArray(annotations)) {
            let palette = Theme.palette();
            let index = 1;
            for (let annotation of annotations) {
                let colorKey = getColorKey(widget, annotation.series, annotation.instance, index);
                items.push({
                    color: Colors.lookup(widget.coloring, colorKey, palette),
                    series: annotation.series,
                    instance: annotation.instance,
                    unit: widget.unit,
                    time: annotation.time,
                    value: annotation.value,
                    attrs: annotation.attrs,
                    fields: widget.fields,
                });
                index++;
            }
        }
        return { id: widget.target + '_annotations', mode: widget.mode, sort: widget.sort, items: items };
    }

    function showAddPageModalDialog() {
        const results = {};
        const input = $('<input/>', { type: 'text'});
        input.change(() => results.input = input.val());
        showModalDialog({
            title: 'Add Page',
            width: 300,
            top: 200,
            content: () => $('<form/>')
                .append($('<label/>').text('Page Name')).append(' ')
                .append(input),
            buttons: [
                { property: 'cancel', label: 'Cancel', secondary: true },
                { property: 'input', label: 'Add Page' }
            ],
            results: results,
            closeProperty: 'cancel',
            onExit: name => {
                if (name != '' && name !== undefined) {
                    MonitoringConsole.View.onPageChange(MonitoringConsole.Model.Page.create(name));
                    showFeedback({ type: 'success', message: 'Your page <em>' + name + '</em> has been added.'});
                }
            }
        });
    }

    function showRoleSelectionModalDialog(onExitCall) {
        const Role = MonitoringConsole.Model.Role;
        const currentRole = Role.isDefined() ? Role.get() : 'guest';
        showModalDialog({
            title: 'User Role Selection',
            width: 400,
            content: () => $('<dl/>')
                .append($('<dt/>').append($('<b/>').text('Guest')))
                .append($('<dd/>').text('Automatically uses latest server page configuration. Existing local changes are overridden. Local changes during the session do not affect the remote configuration.'))
                .append($('<dt/>').append($('<b/>').text('User')))
                .append($('<dd/>').text('Can select for each individual page if server configuration replaces local page. Can manually update local page with server page configuration during the session.'))
                .append($('<dt/>').append($('<b/>').text('Administrator')))
                .append($('<dd/>').text('Can select for each individual page if server configuration replaces local page. Can manually update local pages with server page configuration or update server configuration with local changes. For pages with automatic synchronisation local changes do affect server page configurations.')),
            buttons: [
                { property: 'admin', label: 'Administrator', secondary: true },
                { property: 'user', label: 'User' },
                { property: 'guest', label: 'Guest' },
            ],
            results: { admin: 'admin' , user: 'user', guest: 'guest', current: currentRole },
            closeProperty: 'current',
            onExit: role =>  {
                Role.set(role);
                updateSettings();
                showFeedback({ type: 'success', message: 'User Role changed to <em>' + Role.name() + '</em>' });
                if (onExitCall !== undefined)
                    onExitCall();
            }
        });
    }

    function createNavSidebarModel() {
        const Navigation = MonitoringConsole.Model.Settings.Navigation;
        const Rotation = MonitoringConsole.Model.Settings.Rotation;
        const Refresh = MonitoringConsole.Model.Refresh;
        const Page = MonitoringConsole.Model.Page;
        const pages = [];
        function createNavItem(page) {
            const selected = page.active;
            return {
                id: page.id,
                label: page.name,
                selected: selected,
                onSwitch: selected ? undefined : () => MonitoringConsole.View.onPageChange(Page.changeTo(page.id)),
                onDelete: selected && !Page.hasPreset() ? () => MonitoringConsole.View.onPageDelete() : undefined,
                onRename: selected && !Page.hasPreset() ? name => {
                    Page.rename(name);
                    updatePageNavigation();
                } : undefined,
                onReset: selected && Page.hasPreset() ? () => onPageRefresh(Page.reset()) : undefined,
            };
        }
        for (let page of MonitoringConsole.Model.listPages()) {
            pages.push(createNavItem(page));
        }
        let collapsed = Navigation.isCollapsed();
        return { 
            id: 'NavSidebar', 
            collapsed: collapsed, 
            rotationEnabled: Rotation.isEnabled(),
            refreshEnabled: !Refresh.isPaused(),
            refreshSpeed: Refresh.interval(),
            layoutColumns: Page.numberOfColumns(),
            logo: collapsed ? undefined : 'payara-logo.png',
            pages: pages,
            onLogoClick: () => MonitoringConsole.View.onPageChange(Page.changeTo('core')),
            onSidebarToggle: () => {
                Navigation.toggle();
                updatePageNavigation();
            },
            onRotationToggle: () => {
                Rotation.enabled(!Rotation.isEnabled());
                updateSettings();
                updatePageNavigation();
            },
            onRefreshToggle: () => {
                Refresh.paused(!Refresh.isPaused());
                updateSettings();
                updatePageNavigation();
            },
            onPageAdd: () => {
                showAddPageModalDialog();
            },
            onLayoutChange: numberOfColumns => {
                MonitoringConsole.View.onPageLayoutChange(numberOfColumns);
                updateSettings();
                updatePageNavigation();  
            },
            onRefreshSpeedChange: duration => { 
                Refresh.resume(duration);
                updateSettings();
                updatePageNavigation();
            }
        };
    }

    function createWizardModalDialogModel(initiallySelectedSeries, onExit) {
        if (initiallySelectedSeries !== undefined && !Array.isArray(initiallySelectedSeries))
            initiallySelectedSeries = [ initiallySelectedSeries ];
        function objectToOptions(obj) {
            const options = [];
            for (const [key, value] of Object.entries(obj))
                options.push({ label: value, filter: key });
            return options;
        }

        function loadSeries() {
            return new Promise(function(resolve, reject) {
                Controller.requestListOfSeriesData({ groupBySeries: true, queries: [{
                    widgetId: 'auto', 
                    series: '?:* *',
                    truncate: ['ALERTS', 'POINTS'],
                    exclude: ['ALERTS', 'WATCHES']
                }]}, 
                (response) => resolve(response.matches),
                () => reject(undefined));
            });
        }

        function metadata(match, attr) {
            const metadata = match.annotations.filter(a => a.permanent)[0];
            return metadata === undefined ? undefined : metadata.attrs[attr];
        }

        function matchesText(value, input) {
            return value.toLowerCase().includes(input.toLowerCase());
        }

        const results = {
            ok: initiallySelectedSeries,
            cancel: initiallySelectedSeries,
        };

        const wizard = { 
            key: 'series', 
            entry: ['series', 'displayName', 'description', 'unit'],
            selection: initiallySelectedSeries,
            render: entry => {
                const span = $('<span/>', { title: entry.description || '' });
                if (entry.displayName)
                    span.append($('<b/>').text(entry.displayName)).append(' ');
                span.append($('<code/>').text(entry.series));
                if (entry.unit)
                    span.append(' ').append($('<em/>').text('[' + entry.unit + ']'));
                if (entry.describe && entry.description)
                    span.append($('<p/>').text(entry.description));
                return span;
            },
            // the function that produces match entries
            onSearch: loadSeries,
            // these are the how to get a filter property from a match entry
            properties: {
                ns: match => match.series.startsWith('ns:') ? match.series.substring(3, match.series.indexOf(' ')) : undefined,
                series: match => match.series,
                app: match => metadata(match, 'App'),
                name: match => metadata(match, 'Name'),
                displayName: match => metadata(match, 'DisplayName'),
                description: match => metadata(match, 'Description'),
                type: match => metadata(match, 'Type'),
                property: match => metadata(match, 'Property'),
                unit: match => metadata(match, 'Unit'),
                group: match =>  {
                    let groupIndex = match.series.indexOf(' @:');
                    return groupIndex < 0 ? undefined : match.series.substring(groupIndex + 3, match.series.indexOf(' ', groupIndex + 3));
                },
                metric: match => match.series.substring(match.series.lastIndexOf(' ') + 1),
            },            
            // filters link to the above properties to extract match data
            filters: [
                { label: 'Source', property: 'ns', options: [
                    { label: 'Server Metrics', filter: ns => ns != 'metric' },
                    { label: 'MicroProfile Metrics', filter: 'metric' }
                ]},
                { label: 'MicroProfile Application', property: 'app', requires: { ns: 'metric' }},
                { label: 'MicroProfile Type', property: 'type', requires: { ns: 'metric' }, options: [ // values are as used by MP metrics type
                    { label: 'Counter', filter: 'counter' },
                    { label: 'Timer', filter: 'timer' },
                    { label: 'Gauge', filter: 'gauge' },
                    { label: 'Concurrent Gauge', filter: 'concurrent gauage' },
                    { label: 'Meter', filter: 'meter' },
                    { label: 'Histogram', filter: 'histogram' },
                    { label: 'Simple Timer', filter: 'simple timer' }
                ]},
                { label: 'MicroProfile Unit', property: 'unit', requires: { ns: 'metric' }},
                { label: 'Namespace', property: 'ns', requires: { ns: ns => ns != 'metric' }, 
                    options: () => objectToOptions(MonitoringConsole.Data.NAMESPACES)
                        .filter(option => option.filter != 'metric' && option.filter != 'other') },
                { label: 'MicroProfile Property', property: 'property', requires: { ns: 'metric'} },
                { label: 'MicroProfile Name', property: 'name', requires: { ns: 'metric' }, 
                    filter: matchesText },                
                { label: 'MicroProfile Display Name', property: 'displayName', requires: { ns: 'metric' }, 
                    filter: matchesText },                
                { label: 'MicroProfile Description', property: 'description', requires: { ns: 'metric' }, 
                    filter: matchesText },                
                { label: 'Group', property: 'group' },
                { label: 'Metric', property: 'metric' },
                { label: 'Series', property: 'series', filter: matchesText },
            ],
            // what should happen if the selection made by the user changes
            onChange: selectedSeries => results.ok = selectedSeries,
        };

        return { id: 'ModalDialog', 
            title: 'Select Metric Series...',
            content: () => Components.createSelectionWizard(wizard),
            buttons: [
                { property: 'cancel', label: 'Cancel', secondary: true },
                { property: 'ok', label: 'OK' },
            ],
            results: results,
            closeProperty: 'cancel',
            onExit: onExit,
        };
    }

    function showPagePushModalDialog() {
        showModalDialog(createConfirmModualDialog(
            'Are you sure you want to override all <b>shared</b> pages with the current local state?', 
            'Push All', 'Cancel', () => {
                MonitoringConsole.Model.Page.Sync.pushAllLocal(
                    page => showFeedback({ type: 'success', message: 'Remote page <em>'+ page.name +'</em> updated successfully.' }),
                    page => showFeedback({ type: 'error', message: 'Failed to update remote page <em>'+ page.name +'</em>.' }));
            }));
    }

    /**
     * This function is called when the watch details settings should be opened
     */
    function showWatchConfigModalDialog() {
        function wrapOnSuccess(onSuccess) {
            return () => {
                if (typeof onSuccess === 'function')
                    onSuccess();
                showWatchConfigModalDialog();
            };
        }
        Controller.requestListOfWatches((watches) => {
            const manager = { 
                id: 'WatchManager', 
                items: watches, 
                colors: { red: Theme.color('red'), amber: Theme.color('amber'), green: Theme.color('green') },
                actions: { 
                    onCreate: (watch, onSuccess, onFailure) => Controller.requestCreateWatch(watch, wrapOnSuccess(onSuccess), onFailure),
                    onDelete: (name, onSuccess, onFailure) => Controller.requestDeleteWatch(name, wrapOnSuccess(onSuccess), onFailure),
                    onDisable: (name, onSuccess, onFailure) => Controller.requestDisableWatch(name, wrapOnSuccess(onSuccess), onFailure),
                    onEnable: (name, onSuccess, onFailure) => Controller.requestEnableWatch(name, wrapOnSuccess(onSuccess), onFailure),
                },
            };
            showModalDialog({
                title: 'Manage Watches',
                content: () => Components.createWatchManager(manager),
                buttons: [{ property: 'close', label: 'Close', secondary: true }],
                results: { close: true },                
                closeProperty: 'close',
            });
        });
    }

    /**
     * This function is called when data was received or was failed to receive so the new data can be applied to the page.
     *
     * Depending on the update different content is rendered within a chart box.
     */
    function onDataUpdate(update) {
        let widget = update.widget;
        let data = update.data;
        let alerts = update.alerts;
        let annotations = update.annotations;
        updateDomOfWidget(undefined, widget);
        let widgetNode = $('#widget-' + widget.target);
        let headerNode = widgetNode.find('.WidgetHeader').first();
        let legendNode = widgetNode.find('.Legend').first();
        let indicatorNode = widgetNode.find('.Indicator').first();
            if (indicatorNode.length == 0)
                indicatorNode = widgetNode.find('.RAGIndicator').first();
        let alertsNode = widgetNode.find('.AlertTable').first();
        let annotationsNode = widgetNode.find('.AnnotationTable').first();
        let legend = createLegendModel(widget, data, alerts, annotations); // OBS this has side effect of setting .legend attribute in series data
        if (data !== undefined && (widget.type === 'line' || widget.type === 'bar')) {
            MonitoringConsole.Chart.getAPI(widget).onDataUpdate(update);
        }
        headerNode.replaceWith(Components.createWidgetHeader(createWidgetHeaderModel(widget)));
        if (widget.type == 'rag') {
            alertsNode.hide();
            legendNode.hide();
            indicatorNode.replaceWith(Components.createRAGIndicator(createRAGIndicatorModel(widget, legend)));
            annotationsNode.hide();
        } else {
            alertsNode.replaceWith(Components.createAlertTable(createAlertTableModel(widget, alerts, annotations)));
            legendNode.replaceWith(Components.createLegend(legend));
            indicatorNode.replaceWith(Components.createIndicator(createIndicatorModel(widget, data)));
            annotationsNode.replaceWith(Components.createAnnotationTable(createAnnotationTableModel(widget, annotations)));            
        }
    }

    /**
     * This function refleshes the page with the given layout.
     */
    function onPageUpdate(layout) {
        function addWidgets(selectedSeries, row, col) {
            if (selectedSeries !== undefined && selectedSeries.length > 0) {
                const grid = { column: col, item: row };
                onPageChange(MonitoringConsole.Model.Page.Widgets.add(selectedSeries, grid));
            }
        }
        function createPlusButton(row, col) {
            return $('<button/>', { text: '+', 'class': 'big-plus' })
                .click(() => $('#ModalDialog').replaceWith(Components.createModalDialog(
                    createWizardModalDialogModel([], selectedSeries => addWidgets(selectedSeries, row, col))))); 
        }              
        let numberOfColumns = layout.length;
        let maxRows = layout[0].length;
        let table = $("<table/>", { id: 'chart-grid', 'class': 'columns-'+numberOfColumns + ' rows-'+maxRows });
        let padding = 32;
        let headerHeight = 0;
        let minRowHeight = 160;
        let rowsPerScreen = maxRows;
        let windowHeight = $(window).height();
        let rowHeight = 0;
        while (rowsPerScreen > 0 && rowHeight < minRowHeight) {
            rowHeight = Math.round((windowHeight - headerHeight) / rowsPerScreen) - padding; // padding is subtracted
            rowsPerScreen--; // in case we do another round try one less per screen
        }
        if (rowHeight == 0) {
            rowHeight = windowHeight - headerHeight - padding;
        }
        for (let row = 0; row < maxRows; row++) {
            let tr = $("<tr/>");
            for (let col = 0; col < numberOfColumns; col++) {
                let cell = layout[col][row];
                if (cell) {
                    let rowspan = cell.rowspan;
                    let height = (rowspan * rowHeight);
                    let td = $("<td/>", { id: 'widget-'+cell.widget.target, colspan: cell.colspan, rowspan: rowspan, 'class': 'widget', style: 'height: '+height+"px;"});
                    updateDomOfWidget(td, cell.widget);
                    tr.append(td);
                } else if (cell === null) {
                    tr.append($("<td/>", { 'class': 'widget empty', style: 'height: '+rowHeight+'px;'}).append(createPlusButton(row, col)));                  
                }
            }
            table.append(tr);
        }
        $('#chart-container').empty();
        $('#chart-container').append(table);
    }

    function onPagePush() {
        MonitoringConsole.Model.Page.Sync.pushLocal(onPageRefresh);
    }

    async function onPagePull() {
        await MonitoringConsole.Model.Page.Sync.pullRemote();
        onPageRefresh();
    }

    function showPageSyncModalDialog() {
        MonitoringConsole.Model.Page.Sync.providePullRemoteModel(model => {
            // abses the object properties as a set of ids
            const results = { empty: {}, selected: {} };
            model.onSelection = pageId => results.selected[pageId] = true;
            model.onDeselection = pageId => delete results.selected[pageId];
            showModalDialog({
                title: 'Manage Page Synchronisation',
                content: () => Components.createPageManager(model),
                buttons: [
                    { property: 'empty', label: 'Cancel', secondary: true },
                    { property: 'selected', label: 'Update', tooltip: 'Updates checked pages locally with the remote configuration for these pages' },
                ],
                closeProperty: 'empty',
                results: results,
                onExit: async function(pageIdMap) {
                    const pageIds = Object.keys(pageIdMap);
                    if (pageIds.length > 0) {
                        await model.onUpdate(pageIds);
                        let names = MonitoringConsole.Model.listPages().filter(e => pageIds.indexOf(e.id) >= 0).map(e => e.name).join(', ');
                        showFeedback({type: 'success', message: 'Updated local pages <em>' + names + '</em> with remote configuration.'});
                        onPageRefresh(); 
                    }
                },
            });
        });
    }    

    function onPageRefresh() {
        onPageChange(MonitoringConsole.Model.Page.changeTo(MonitoringConsole.Model.Page.id()));
    }

    /**
     * Method to call when page changes to update UI elements accordingly
     */
    function onPageChange(layout) {
        MonitoringConsole.Chart.Trace.onClosePopup();
        $('#chart-grid').show();
        onPageUpdate(layout);
        updatePageNavigation();
        updateSettings();
    }

    /**
     * Public API of the View object:
     */
    return {
        Units: Units,
        Colors: Colors,
        Components: Components,
        onPageReady: function() {
            let hash = window.location.hash;
            let targetPageId = hash.length <= 1 ? undefined : hash.substring(1);
            // connect the view to the model by passing the 'onDataUpdate' function to the model
            // which will call it when data is received
            let layout = MonitoringConsole.Model.init(onDataUpdate, onPageChange);
            if (targetPageId === undefined)
                onPageChange(layout);
            Colors.scheme('Payara', false);
            if (targetPageId)
                onPageChange(MonitoringConsole.Model.Page.changeTo(targetPageId));
            $(window).on('hashchange', function(e) {
                let pageId = window.location.hash.substring(1);
                if (pageId != MonitoringConsole.Model.Page.id()) {
                    onPageChange(MonitoringConsole.Model.Page.changeTo(pageId));
                }
            });
            if (!MonitoringConsole.Model.Role.isDefined()) {
                showRoleSelectionModalDialog(showPageSyncModalDialog);
            } else {
                showPageSyncModalDialog();
            }
        },
        onPageChange: (layout) => onPageChange(layout),
        onPageUpdate: (layout) => onPageUpdate(layout),
        onPageReset: () => onPageChange(MonitoringConsole.Model.Page.reset()),
        onPageImport: (src) => MonitoringConsole.Model.importPages(src, onPageChange),
        onPageExport: () => onPageExport('monitoring-console-config.json', MonitoringConsole.Model.exportPages()),
        onPageMenu: function() { MonitoringConsole.Model.Settings.toggle(); updateSettings(); },
        onPageLayoutChange: (numberOfColumns) => onPageUpdate(MonitoringConsole.Model.Page.arrange(numberOfColumns)),
        onPageDelete: () => {
            const name = MonitoringConsole.Model.Page.name();
            showModalDialog(createConfirmModualDialog('Are you sure you want to delete the page <em>'+name+'</em>?', 'Delete', 'Cancel', () => {
                onPageUpdate(MonitoringConsole.Model.Page.erase());
                updatePageNavigation();
                showFeedback({ type: 'success', message: 'Your page <em>' + name + '</em> has been deleted.' });             
            }));
        },
    };
})();
