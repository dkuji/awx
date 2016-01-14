/*************************************************
 * Copyright (c) 2015 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

/**
 * @ngdoc function
 * @name controllers.function:Teams
 * @description This controller's for teams
*/


export function TeamsList($scope, $rootScope, $location, $log, $stateParams,
    Rest, Alert, TeamList, GenerateList, Prompt, SearchInit, PaginateInit,
    ReturnToCaller, ClearScope, ProcessErrors, SetTeamListeners, GetBasePath,
    SelectionInit, Wait, Stream, $state) {

    ClearScope();

    var list = TeamList,
        defaultUrl = GetBasePath('teams'),
        generator = GenerateList,
        paths = $location.path().replace(/^\//, '').split('/'),
        mode = (paths[0] === 'teams') ? 'edit' : 'select',
        url;

    generator.inject(list, { mode: mode, scope: $scope });
    $scope.selected = [];

    url = GetBasePath('base') + $location.path() + '/';
    SelectionInit({
        scope: $scope,
        list: list,
        url: url,
        returnToCaller: 1
    });

    if ($scope.removePostRefresh) {
        $scope.removePostRefresh();
    }
    $scope.removePostRefresh = $scope.$on('PostRefresh', function () {
        // After a refresh, populate the organization name on each row
        var i;
        if ($scope.teams) {
            for (i = 0; i < $scope.teams.length; i++) {
                if ($scope.teams[i].summary_fields.organization) {
                    $scope.teams[i].organization_name = $scope.teams[i].summary_fields.organization.name;
                }
            }
        }
    });

    SearchInit({
        scope: $scope,
        set: 'teams',
        list: list,
        url: defaultUrl
    });
    PaginateInit({
        scope: $scope,
        list: list,
        url: defaultUrl
    });
    $scope.search(list.iterator);

    $scope.showActivity = function () {
        Stream({ scope: $scope });
    };

    $scope.addTeam = function () {
        $state.transitionTo('teams.add');
    };

    $scope.editTeam = function (id) {
        $state.transitionTo('teams.edit', {team_id: id});
    };

    $scope.deleteTeam = function (id, name) {

        var action = function () {
            Wait('start');
            var url = defaultUrl + id + '/';
            Rest.setUrl(url);
            Rest.destroy()
                .success(function () {
                    Wait('stop');
                    $('#prompt-modal').modal('hide');
                    $scope.search(list.iterator);
                })
                .error(function (data, status) {
                    Wait('stop');
                    $('#prompt-modal').modal('hide');
                    ProcessErrors($scope, data, status, null, {
                        hdr: 'Error!',
                        msg: 'Call to ' + url + ' failed. DELETE returned status: ' + status
                    });
                });
        };

        Prompt({
            hdr: 'Delete',
            body: '<div class=\"alert alert-info\">Delete team ' + name + '?</div>',
            action: action
        });
    };
}

TeamsList.$inject = ['$scope', '$rootScope', '$location', '$log',
    '$stateParams', 'Rest', 'Alert', 'TeamList', 'generateList', 'Prompt',
    'SearchInit', 'PaginateInit', 'ReturnToCaller', 'ClearScope',
    'ProcessErrors', 'SetTeamListeners', 'GetBasePath', 'SelectionInit', 'Wait',
    'Stream', '$state'
];


export function TeamsAdd($scope, $rootScope, $compile, $location, $log,
    $stateParams, TeamForm, GenerateForm, Rest, Alert, ProcessErrors,
    ReturnToCaller, ClearScope, GenerateList, OrganizationList, SearchInit,
    PaginateInit, GetBasePath, LookUpInit, Wait, $state) {
    ClearScope('htmlTemplate'); //Garbage collection. Don't leave behind any listeners/watchers from the prior
    //$scope.

    // Inject dynamic view
    var defaultUrl = GetBasePath('teams'),
        form = TeamForm,
        generator = GenerateForm,
        scope = generator.inject(form, { mode: 'add', related: false });

    $rootScope.flashMessage = null;
    generator.reset();

    LookUpInit({
        scope: $scope,
        form: form,
        current_item: null,
        list: OrganizationList,
        field: 'organization',
        input_type: 'radio'
    });

    // Save
    $scope.formSave = function () {
        var fld, data;
        generator.clearApiErrors();
        Wait('start');
        Rest.setUrl(defaultUrl);
        data = {};
        for (fld in form.fields) {
            data[fld] = scope[fld];
        }
        Rest.post(data)
            .success(function (data) {
                Wait('stop');
                $rootScope.flashMessage = "New team successfully created!";
                $location.path('/teams/' + data.id);
            })
            .error(function (data, status) {
                Wait('stop');
                ProcessErrors($scope, data, status, form, { hdr: 'Error!', msg: 'Failed to add new team. Post returned status: ' +
                    status });
            });
    };

    $scope.formCancel = function () {
        $state.transitionTo('teams');
    };
}

TeamsAdd.$inject = ['$scope', '$rootScope', '$compile', '$location', '$log',
    '$stateParams', 'TeamForm', 'GenerateForm', 'Rest', 'Alert',
    'ProcessErrors', 'ReturnToCaller', 'ClearScope', 'generateList',
    'OrganizationList', 'SearchInit', 'PaginateInit', 'GetBasePath',
    'LookUpInit', 'Wait', '$state'
];


export function TeamsEdit($scope, $rootScope, $compile, $location, $log,
    $stateParams, TeamForm, GenerateForm, Rest, Alert, ProcessErrors,
    RelatedSearchInit, RelatedPaginateInit, ReturnToCaller, ClearScope,
    LookUpInit, Prompt, GetBasePath, CheckAccess, OrganizationList, Wait,
    Stream, fieldChoices, fieldLabels, permissionsSearchSelect, $state) {

    ClearScope();

    var defaultUrl = GetBasePath('teams'),
        generator = GenerateForm,
        form = TeamForm,
        base = $location.path().replace(/^\//, '').split('/')[0],
        master = {},
        id = $stateParams.team_id,
        relatedSets = {};

    $scope.permission_label = {};
    $scope.permission_search_select = [];

    // return a promise from the options request with the permission type choices (including adhoc) as a param
    var permissionsChoice = fieldChoices({
        scope: $scope,
        url: 'api/v1/' + base + '/' + id + '/permissions/',
        field: 'permission_type'
    });

    // manipulate the choices from the options request to be set on
    // scope and be usable by the list form
    permissionsChoice.then(function (choices) {
        choices =
            fieldLabels({
                choices: choices
            });
        _.map(choices, function(n, key) {
            $scope.permission_label[key] = n;
        });
    });

    // manipulate the choices from the options request to be usable
    // by the search option for permission_type, you can't inject the
    // list until this is done!
    permissionsChoice.then(function (choices) {
        form.related.permissions.fields.permission_type.searchOptions =
            permissionsSearchSelect({
                choices: choices
            });
        generator.inject(form, { mode: 'edit', related: true, scope: $scope });
        generator.reset();
        $scope.$emit('loadTeam');
    });

    $scope.team_id = id;

    $scope.PermissionAddAllowed = false;

    // Retrieve each related set and any lookups
    if ($scope.loadTeamRemove) {
        $scope.loadTeamRemove();
    }
    $scope.loadTeamRemove = $scope.$on('loadTeam', function () {
        // Retrieve detail record and prepopulate the form
        Wait('start');
        Rest.setUrl(defaultUrl + ':id/');
        Rest.get({
            params: {
                id: id
            }
        })
            .success(function (data) {
                var fld, related, set;
                $scope.team_name = data.name;
                for (fld in form.fields) {
                    if (data[fld]) {
                        $scope[fld] = data[fld];
                        master[fld] = $scope[fld];
                    }
                }
                related = data.related;
                for (set in form.related) {
                    if (related[set]) {
                        relatedSets[set] = {
                            url: related[set],
                            iterator: form.related[set].iterator
                        };
                    }
                }
                // Initialize related search functions. Doing it here to make sure relatedSets object is populated.
                RelatedSearchInit({
                    scope: $scope,
                    form: form,
                    relatedSets: relatedSets
                });
                RelatedPaginateInit({
                    scope: $scope,
                    relatedSets: relatedSets
                });

                LookUpInit({
                    scope: $scope,
                    form: form,
                    current_item: data.organization,
                    list: OrganizationList,
                    field: 'organization',
                    input_type: 'radio'
                });

                $scope.organization_url = data.related.organization;
                $scope.organization_name = data.summary_fields.organization.name;
                master.organization_name = data.summary_fields.organization.name;

                // get related object values and populate
                for (var relatedValues in relatedSets) {
                    $scope.search(relatedSets[relatedValues].iterator);
                }
                CheckAccess({ scope: $scope }); //Does the user have access to add/edit Permissions?
                Wait('stop');
            })
            .error(function (data, status) {
                ProcessErrors($scope, data, status, form, { hdr: 'Error!', msg: 'Failed to retrieve team: ' + $stateParams.team_id +
                    '. GET status: ' + status });
                Wait('stop');
            });
    });

    $scope.getPermissionText = function () {
        if (this.permission.permission_type !== "admin" && this.permission.run_ad_hoc_commands) {
            return $scope.permission_label[this.permission.permission_type] +
            " and " + $scope.permission_label.adhoc;
        } else {
            return $scope.permission_label[this.permission.permission_type];
        }
    };

    $scope.showActivity = function () {
        Stream({ scope: $scope });
    };

    // Save changes to the parent
    $scope.formSave = function () {
        var data = {}, fld;
        generator.clearApiErrors();
        Wait('start');
        $rootScope.flashMessage = null;
        Rest.setUrl(defaultUrl + $stateParams.team_id + '/');
        for (fld in form.fields) {
            data[fld] = $scope[fld];
        }
        Rest.put(data)
            .success(function () {
                Wait('stop');
                var base = $location.path().replace(/^\//, '').split('/')[0];
                $scope.team_name = $scope.name;
                if (base === 'teams') {
                    ReturnToCaller();
                }
                else {
                    ReturnToCaller(1);
                }
            })
            .error(function (data, status) {
                Wait('stop');
                ProcessErrors($scope, data, status, form, { hdr: 'Error!',
                    msg: 'Failed to update team: ' + $stateParams.team_id + '. PUT status: ' + status });
            });
    };

    $scope.formCancel = function () {
        $state.transitionTo('teams');
    };

    // Related set: Add button
    $scope.add = function (set) {
        $rootScope.flashMessage = null;
        if (set === 'permissions') {
            if ($scope.PermissionAddAllowed) {
                $location.path('/' + base + '/' + $stateParams.team_id + '/' + set + '/add');
            } else {
                Alert('Access Denied', 'You do not have access to this function. Please contact your system administrator.');
            }
        } else {
            $location.path('/' + base + '/' + $stateParams.team_id + '/' + set);
        }
    };

    // Related set: Edit button
    $scope.edit = function (set, id) {
        $rootScope.flashMessage = null;
        if (set === 'permissions') {
            $location.path('/' + base + '/' + $stateParams.team_id + '/' + set + '/' + id);
        } else {
            $location.path('/' + set + '/' + id);
        }
    };

    // Related set: Delete button
    $scope['delete'] = function (set, itm_id, name, title) {
        $rootScope.flashMessage = null;

        var action = function () {
            var url;
            if (set === 'permissions') {
                if ($scope.PermissionAddAllowed) {
                    url = GetBasePath('base') + 'permissions/' + itm_id + '/';
                    Rest.setUrl(url);
                    Rest.destroy()
                        .success(function () {
                            $('#prompt-modal').modal('hide');
                            $scope.search(form.related[set].iterator);
                        })
                        .error(function (data, status) {
                            $('#prompt-modal').modal('hide');
                            ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Call to ' + url +
                                ' failed. DELETE returned status: ' + status });
                        });
                } else {
                    Alert('Access Denied', 'You do not have access to this function. Please contact your system administrator.');
                }
            } else {
                url = defaultUrl + $stateParams.team_id + '/' + set + '/';
                Rest.setUrl(url);
                Rest.post({ id: itm_id, disassociate: 1 })
                    .success(function () {
                        $('#prompt-modal').modal('hide');
                        $scope.search(form.related[set].iterator);
                    })
                    .error(function (data, status) {
                        $('#prompt-modal').modal('hide');
                        ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Call to ' + url +
                            ' failed. POST returned status: ' + status });
                    });
            }
        };

        Prompt({
            hdr: 'Delete',
            body: 'Are you sure you want to remove ' + name + ' from ' + $scope.name + ' ' + title + '?',
            action: action
        });
    };
}

TeamsEdit.$inject = ['$scope', '$rootScope', '$compile', '$location', '$log',
    '$stateParams', 'TeamForm', 'GenerateForm', 'Rest', 'Alert',
    'ProcessErrors', 'RelatedSearchInit', 'RelatedPaginateInit',
    'ReturnToCaller', 'ClearScope', 'LookUpInit', 'Prompt', 'GetBasePath',
    'CheckAccess', 'OrganizationList', 'Wait', 'Stream', 'fieldChoices',
    'fieldLabels', 'permissionsSearchSelect', '$state'
];