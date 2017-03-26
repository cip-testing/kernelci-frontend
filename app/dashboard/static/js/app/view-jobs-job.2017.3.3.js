/*! Kernel CI Dashboard | Licensed under the GNU GPL v3 (or later) */
require([
    'jquery',
    'utils/init',
    'utils/format',
    'utils/request',
    'utils/error',
    'utils/table',
    'utils/urls',
    'charts/passrate',
    'utils/html',
    'tables/job',
    'utils/date'
], function($, init, format, r, e, table, u, chart, html, jobt) {
    'use strict';
    var gBranchRegEx;
    var gBuildsTable;
    var gJobName;
    var gNumberRange;
    var gPageLen;
    var gSearchFilter;

    setTimeout(function() {
        document.getElementById('li-job').setAttribute('class', 'active');
    }, 15);

    gJobName = null;
    gPageLen = null;
    gSearchFilter = null;

    gNumberRange = 20;
    // Needed to translate git branch refnames from x/y into x:y or the
    // forward slash will not work with URLs.
    gBranchRegEx = new RegExp('/+', 'g');

    function getBootStatsFail() {
        html.replaceContent(
            document.getElementById('boot-pass-rate'),
            html.errorDiv('Error loading boot data.'));
    }

    function getBootStatsDone(response) {
        chart.bootpassrate('boot-pass-rate', response);
    }

    function getBootStats(startDate, dateRange) {
        var data;

        data = {
            job: gJobName,
            sort: 'created_on',
            sort_order: 1,
            created_on: startDate,
            date_range: dateRange,
            field: ['status', 'kernel', 'created_on', 'job'],
            nfield: ['_id']
        };

        $.when(r.get('/_ajax/boot', data))
            .fail(e.error, getBootStatsFail)
            .done(getBootStatsDone);
    }

    function getBuildsStatsFail() {
        html.replaceContent(
            document.getElementById('build-pass-rate'),
            html.errorDiv('Error loading build data.'));
    }

    function getBuildsStatsDone(response) {
        chart.buildpassrate('build-pass-rate', response);
    }

    function getBuildsStats(startDate, dateRange) {
        var data;

        data = {
            job: gJobName,
            sort: 'created_on',
            sort_order: 1,
            created_on: startDate,
            date_range: dateRange,
            field: ['status', 'kernel', 'created_on', 'job'],
            nfield: ['_id']
        };

        $.when(r.get('/_ajax/build', data))
            .fail(e.error, getBuildsStatsFail)
            .done(getBuildsStatsDone);
    }

    function getTrendsData(response) {
        var firstDate;
        var lDateRange;
        var lastDate;
        var resLen;
        var results;

        results = response.result;
        resLen = results.length;
        lDateRange = 0;

        if (resLen > 0) {
            firstDate = new Date(results[0].created_on.$date);
            if (resLen > 1) {
                lastDate = new Date(results[resLen - 1].created_on.$date);
                lDateRange = Math.round((firstDate - lastDate) / 86400000);
            }

            getBuildsStats(firstDate.toCustomISODate(), lDateRange);
            getBootStats(firstDate.toCustomISODate(), lDateRange);
        } else {
            html.replaceContent(
                document.getElementById('build-pass-rate'),
                html.errorDiv('No build data available.'));

            html.replaceContent(
                document.getElementById('boot-pass-rate'),
                html.errorDiv('No boot data available.'));
        }
    }

    function getBuildBootCountFail() {
        html.replaceByClass('count-badge', '&infin;');
    }

    function getBuildBootCountDone(response) {
        var batchCount;
        var batchData;

        batchData = response.result;

        if (batchData.length > 0) {
            batchData.forEach(function(batchRes) {
                batchCount = batchRes.result[0].count;
                html.replaceContent(
                    document.getElementById(batchRes.operation_id),
                    document.createTextNode(batchCount));
            });
        }
        // Perform the table search now, after completing all operations.
        gBuildsTable
            .pageLen(gPageLen)
            .search(gSearchFilter);
    }

    function getBuildBootCount(response) {
        var batchOps;
        var deferred;
        var kernel;
        var queryStr;
        var results;

        function _createOp(result) {
            kernel = result.kernel;
            queryStr = 'job=';
            queryStr += gJobName;
            queryStr += '&kernel=';
            queryStr += kernel;
            queryStr += '&git_branch=';
            queryStr += result.git_branch;

            // Get total build count.
            batchOps.push({
                method: 'GET',
                operation_id: 'build-total-count-' + kernel,
                resource: 'count',
                document: 'build',
                query: queryStr
            });

            // Get the successful build count.
            batchOps.push({
                method: 'GET',
                operation_id: 'build-success-count-' + kernel,
                resource: 'count',
                document: 'build',
                query: 'status=PASS&' + queryStr
            });

            // Get failed build count.
            batchOps.push({
                method: 'GET',
                operation_id: 'build-fail-count-' + kernel,
                resource: 'count',
                document: 'build',
                query: 'status=FAIL&' + queryStr
            });

            // Get unknown build count.
            batchOps.push({
                method: 'GET',
                operation_id: 'build-unknown-count-' + kernel,
                resource: 'count',
                document: 'build',
                query: 'status=UNKNOWN&' + queryStr
            });

            // Get total boot reports count.
            batchOps.push({
                method: 'GET',
                operation_id: 'boot-total-count-' + kernel,
                resource: 'count',
                document: 'boot',
                query: queryStr
            });

            // Get successful boot reports count.
            batchOps.push({
                method: 'GET',
                operation_id: 'boot-success-count-' + kernel,
                resource: 'count',
                document: 'boot',
                query: 'status=PASS&' + queryStr
            });

            // Get failed boot reports count.
            batchOps.push({
                method: 'GET',
                operation_id: 'boot-fail-count-' + kernel,
                resource: 'count',
                document: 'boot',
                query: 'status=FAIL&' + queryStr
            });

            // Get unknown boot reports count.
            batchOps.push({
                method: 'GET',
                operation_id: 'boot-unknown-count-' + kernel,
                resource: 'count',
                document: 'boot',
                query: 'status=OFFLINE&status=UNTRIED&' + queryStr
            });
        }

        results = response.result;
        if (results.length > 0) {
            batchOps = [];
            results.forEach(_createOp);

            deferred = r.post(
                '/_ajax/batch', JSON.stringify({batch: batchOps}));

            $.when(deferred)
                .fail(e.error, getBuildBootCountFail)
                .done(getBuildBootCountDone);
        } else {
            html.replaceByClass('count-badge', '?');
        }
    }

    function getBuildsDone(response) {
        var columns,
            results;

        /**
         * Create the table column title for the builds count.
        **/
        function _buildColumTitle() {
            var tooltipNode;

            tooltipNode = html.tooltip();
            tooltipNode.setAttribute(
                'title', 'Total/Successful/Failed/Unknown build reports');
            tooltipNode.appendChild(
                document.createTextNode('Build Status'));

            return tooltipNode.outerHTML;
        }

        /**
         * Create the table column title for the boots count.
        **/
        function _bootColumnTitle() {
            var tooltipNode;

            tooltipNode = html.tooltip();
            tooltipNode.setAttribute(
                'title', 'Total/Successful/Failed/Other boot reports');
            tooltipNode.appendChild(
                document.createTextNode('Boot Status'));

            return tooltipNode.outerHTML;
        }

        /**
         * Wrapper to provide the href.
        **/
        function _renderDetails(data, type, object) {
            var href = '/build/';
            href += gJobName;
            href += '/branch/';
            href += object.git_branch;
            href += '/kernel/';
            href += data;
            href += '/';
            return jobt.renderDetails(href, type);
        }

        /**
         * Wrapper to provide the href.
        **/
        function _renderBootCount(data, type) {
            var href = '/boot/all/job/';
            href += gJobName;
            href += '/kernel/';
            href += data;
            return jobt.renderTableBootCount(data, type, href);
        }

        /**
         * Wrapper to provide the href.
        **/
        function _renderKernel(data, type) {
            var href = '/build/';
            href += gJobName;
            href += '/kernel/';
            href += data;
            href += '/';
            return jobt.renderKernel(data, type, href);
        }

        /**
         * Wrapper to provide the href.
        **/
        function _renderCommit(data, type, object) {
            var gitURLs;

            gitURLs = u.translateCommit(object.git_url, data);
            return jobt.renderCommit(data, type, gitURLs[1]);
        }

        function _renderBranch(data, type) {
            var aNode;
            var branch;
            var rendered;
            var tooltipNode;
            var href;

            branch = data.replace(gBranchRegEx, ':', 'g');
            rendered = data;
            if (type === 'display') {
                tooltipNode = html.tooltip();
                tooltipNode.setAttribute('title', data);

                aNode = document.createElement('a');
                aNode.className = 'table-link';
                href = '/job/';
                href += gJobName;
                href += '/branch/';
                href += branch;
                aNode.setAttribute('href', href);

                aNode.appendChild(document.createTextNode(data));
                tooltipNode.appendChild(aNode);

                rendered = tooltipNode.outerHTML;
            }

            return rendered;
        }

        results = response.result;
        if (results.length === 0) {
            html.removeElement(document.getElementById('table-loading'));
            html.replaceContent(
                document.getElementById('table-div'),
                html.errorDiv('No build data available.'));
        } else {
            columns = [
                {
                    data: 'git_branch',
                    title: 'Branch',
                    type: 'string',
                    className: 'branch-column',
                    render: _renderBranch
                },
                {
                    data: 'kernel',
                    title: 'Kernel',
                    type: 'string',
                    className: 'kernel-column',
                    render: _renderKernel
                },
                {
                    data: 'git_commit',
                    title: 'Commit',
                    type: 'string',
                    className: 'commit-column',
                    render: _renderCommit
                },
                {
                    data: 'kernel',
                    title: _buildColumTitle(),
                    type: 'string',
                    className: 'build-count pull-center',
                    render: jobt.renderTableBuildCount
                },
                {
                    data: 'kernel',
                    title: _bootColumnTitle(),
                    type: 'string',
                    className: 'boot-count pull-center',
                    render: _renderBootCount
                },
                {
                    data: 'created_on',
                    title: 'Date',
                    type: 'date',
                    className: 'date-column pull-center',
                    render: jobt.renderDate
                },
                {
                    data: 'kernel',
                    title: '',
                    orderable: false,
                    searchable: false,
                    type: 'string',
                    className: 'select-column pull-center',
                    render: _renderDetails
                }
            ];

            gBuildsTable
                .data(results)
                .columns(columns)
                .order([5, 'desc'])
                .rowURL(
                    '/build/%(job)s/branch/%(git_branch)s/kernel/%(kernel)s/')
                .rowURLElements(['job', 'git_branch', 'kernel'])
                .paging(false)
                .info(false)
                .draw();
        }
    }

    function getBuildsFailed() {
        html.removeElement(document.getElementById('table-loading'));
        html.replaceContent(
            document.getElementById('table-div'),
            html.errorDiv('Error loading build data.'));
    }

    function getBuilds() {
        var data;

        data = {
            aggregate: 'kernel',
            job: gJobName,
            sort: 'created_on',
            sort_order: -1,
            limit: gNumberRange,
            field: [
                'job',
                'kernel',
                'created_on',
                'git_branch',
                'git_commit',
                'git_url'
            ]
        };

        $.when(r.get('/_ajax/build', data))
            .fail(
                e.error,
                getBuildsFailed, getBuildsStatsFail, getBootStatsFail)
            .done(getTrendsData, getBuildsDone, getBuildBootCount);
    }

    function getDetailsDone(response) {
        var firstCount;
        var firstResult;
        var resLen;
        var results;
        var secondCount;
        var secondResult;
        var thirdCount;
        var thirdResult;

        results = response.result;
        resLen = results.length;

        if (resLen === 3) {
            firstResult = results[0];
            secondResult = results[1];
            thirdResult = results[2];

            firstCount = firstResult.result[0].count;
            secondCount = secondResult.result[0].count;
            thirdCount = thirdResult.result[0].count;

            html.replaceContent(
                document.getElementById(firstResult.operation_id),
                document.createTextNode(format.number(firstCount)));

            html.replaceContent(
                document.getElementById(secondResult.operation_id),
                document.createTextNode(format.number(secondCount)));

            html.replaceContent(
                document.getElementById(thirdResult.operation_id),
                document.createTextNode(format.number(thirdCount)));
        } else {
            html.replaceByClass('count-list-badge', '?');
        }
    }

    function getDetailsFailed() {
        html.replaceByClass('count-list-badge', '&infin;');
    }

    function getDetails() {
        var batchOps;
        var deferred;
        var queryString;

        queryString = 'job=' + gJobName;
        batchOps = [];

        batchOps.push({
            operation_id: 'builds-count',
            method: 'GET',
            resource: 'count',
            document: 'job',
            query: queryString
        });

        batchOps.push({
            operation_id: 'defconfs-count',
            method: 'GET',
            resource: 'count',
            document: 'build',
            query: queryString
        });

        batchOps.push({
            operation_id: 'boot-reports-count',
            method: 'GET',
            resource: 'count',
            document: 'boot',
            query: queryString
        });

        deferred = r.post(
            '/_ajax/batch', JSON.stringify({batch: batchOps}));

        $.when(deferred)
            .fail(e.error, getDetailsFailed)
            .done(getDetailsDone);
    }

    if (document.getElementById('number-range') !== null) {
        gNumberRange = document.getElementById('number-range').value;
    }
    if (document.getElementById('job-name') !== null) {
        gJobName = document.getElementById('job-name').value;
    }
    if (document.getElementById('page-len') !== null) {
        gPageLen = document.getElementById('page-len').value;
    }
    if (document.getElementById('search-filter') !== null) {
        gSearchFilter = document.getElementById('search-filter').value;
    }

    gBuildsTable = table({
        tableId: 'jobstable',
        tableLoadingDivId: 'table-loading',
        tableDivId: 'table-div'
    });

    setTimeout(getDetails, 10);
    setTimeout(getBuilds, 10);

    setTimeout(init.hotkeys, 50);
    setTimeout(init.tooltip, 50);
});
