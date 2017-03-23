/*! Kernel CI Dashboard | Licensed under the GNU GPL v3 (or later) */
define([
    'utils/html',
    'utils/urls'
], function(html, urls) {
    'use strict';
    var gBoot;

    gBoot = {};

    /**
     * Create the boot logs element.
     *
     * @private
     * @param {string} txtLog: The TXT boot log file name.
     * @param {string} htmlLog: The HTML boot log file name.
     * @param {string} labName: The name of the boot lab.
     * @param {URI} serverURI: The URI of the file server.
     * @param {string} pathURI: The path part to the log file on the server.
     * @return {Element} An HTML node if at least on of txtLog or htmlLog
     * are not null or null.
    **/
    gBoot.createBootLog = function(
            txtLog, htmlLog, labName, serverURI, pathURI) {
        var aNode;
        var logPath;
        var retVal;
        var tooltipNode;

        retVal = null;
        if (txtLog || htmlLog) {
            retVal = document.createElement('span');

            if (txtLog) {
                if (txtLog.search(labName) === -1) {
                    logPath = urls.getHref(serverURI, [
                        pathURI,
                        labName,
                        txtLog
                    ]);
                } else {
                    logPath = urls.getHref(serverURI, [
                        pathURI,
                        txtLog
                    ]);
                }

                tooltipNode = html.tooltip();
                tooltipNode.setAttribute('title', 'View raw text log');

                aNode = document.createElement('a');
                aNode.setAttribute('href', logPath);
                aNode.appendChild(document.createTextNode('txt'));
                aNode.insertAdjacentHTML('beforeend', '&nbsp;');
                aNode.appendChild(html.external());

                tooltipNode.appendChild(aNode);
                retVal.appendChild(tooltipNode);
            }

            if (htmlLog) {
                if (txtLog) {
                    retVal.insertAdjacentHTML(
                        'beforeend', '&nbsp;&mdash;&nbsp;');
                }

                if (htmlLog.search(labName) === -1) {
                    logPath = urls.getHref(serverURI, [
                        pathURI,
                        labName,
                        htmlLog
                    ]);
                } else {
                    logPath = urls.getHref(serverURI, [
                        pathURI,
                        htmlLog
                    ]);
                }

                tooltipNode = html.tooltip();
                tooltipNode.setAttribute('title', 'View HTML log');

                aNode = document.createElement('a');
                aNode.setAttribute('href', logPath);
                aNode.appendChild(document.createTextNode('html'));
                aNode.insertAdjacentHTML('beforeend', '&nbsp;');
                aNode.appendChild(html.external());

                tooltipNode.appendChild(aNode);
                retVal.appendChild(tooltipNode);
            }
        }

        return retVal;
    };

    return gBoot;
});
