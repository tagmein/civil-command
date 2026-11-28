-- file lane-control.fs
; to lane-notebook ; load /src/lane-notebook.fs
; to lane-inputs ; load /src/lane-inputs.fs
; to lane-config-modal ; load /src/lane-config-modal.fs
; to lane-import-modal ; load /src/lane-import-modal.fs
; to lane-export-modal ; load /src/lane-export-modal.fs
; to lane-export-deploy-modal ; load /src/lane-export-deploy-modal.fs
; to lane-modal-mod ; load /src/lane-modal.fs
; to confirm-modal-mod ; load /src/confirm-modal.fs
; to row-picker-modal-mod ; load /src/lane-row-picker-modal.fs
; to lane-session-modal-mod ; load /src/lane-session-modal.fs
; to lane-package-modal-mod ; load /src/lane-package-modal.fs
; to lane-dir-modal-mod ; load /src/lane-dir-modal.fs
; to lane-line-info-mod ; load /src/lane-line-info-modal.fs
; to lane-terminal-modal-mod ; load /src/lane-terminal-modal.fs
; to lane-servers-modal-mod ; load /src/lane-servers-modal.fs
; to lane-rails ; load /src/lane-rails.fs
; to default-body-bg '#202020'
; to default-scrollbar-color [ match
 { $defaultScrollbarColor : $defaultScrollbarColor }
 { true : '#383838' }
]
; to min-lane-modal-width [ match
 { [ propertyIsGreaterThan 0 minLaneModalWidth ] : $minLaneModalWidth }
 { true : 480 }
]
; to min-lane-modal-height [ match
 { [ propertyIsGreaterThan 0 minLaneModalHeight ] : $minLaneModalHeight }
 { true : 420 }
]
; to scope [ object
 { lanes {} }
 { lane-ids {} }
 { by-id ; object }
 { catalog ; object }
 { line-num-cache ; object }
 { active-imports ; object }
 { preferences-lane-id null }
 { preferences-loading false }
 { preferences ; object }
 { preferences-timezones {} }
 { clock-timezone browser }
 { clock-hour-format '12h' }
 { clock-show-seconds true }
 { sync-seq 0 }
 { clear-seq 0 }
 { links-seq 0 }
 { opening-by-id ; object }
 { session-init-tracker null }
 { last-session-init-result null }
 { cron-timers ; object }
 { cron-running ; object }
 { scroll-raf-id null }
 { session-id null }
 { browser-session-id null }
 { session-overridden false }
 { session-data-dir null }
 { session-data-dir-confirmed false }
 { session-dirs-disabled false }
 { session-meta ; object }
 { open-package-ids {} }
 { open-packages {} }
 { active-package-id '' }
 { saved-lane-ids {} }
 { saved-pathname '/' }
 { saved-package-ids {} }
 { saved-active-package-id '' }
 { table-display-options ; object }
 { saved-table-display-options ; object }
 { session-settings ; object { minimap false } { minimapScale 1 } }
 { session-minimap false }
 { session-minimap-scale 1 }
 { session-dirty false }
 { session-status-pending false }
 { session-status-label '' }
 { session-pending-count 0 }
 { recent-sessions {} }
 { session-history {} }
 { previous-session-ids {} }
 { next-session-ids {} }
 { resolved-previous-sessions {} }
 { resolved-next-sessions {} }
 { available-previous-sessions {} }
 { available-next-sessions {} }
 { workspace-summary null }
 { fullscreen-lane null }
 { fullscreen-lane-id null }
 { is-lane-fullscreen false }
 { fullscreen-was-pinned false }
 { unlocking-export-packages false }
]
[ match
 { $window.localStorage.getItem (
  ; to ls-tz !window.localStorage.getItem clock-timezone
  [ match
   { [ propertyIs null ls-tz ] : null }
   { [ propertyIs undefined ls-tz ] : null }
   { [ propertyIs '' ls-tz ] : null }
   { true : ; set $ls-tz scope.clock-timezone }
  ]
  ; to ls-hr !window.localStorage.getItem clock-hour-format
  [ match
   { [ propertyIs null ls-hr ] : null }
   { [ propertyIs undefined ls-hr ] : null }
   { [ propertyIs '' ls-hr ] : null }
   { true (
    ; to norm-hr [ match
     { $normalizeClockHourFormat : !normalizeClockHourFormat $ls-hr $window.Intl }
     { [ propertyIs '24h' ls-hr ] : '24h' }
     { [ propertyIs '24' ls-hr ] : '24h' }
     { true : '12h' }
    ]
    ; set $norm-hr scope.clock-hour-format
   ) }
  ]
  ; to ls-sec !window.localStorage.getItem clock-show-seconds
  [ match
   { [ propertyIs null ls-sec ] : null }
   { [ propertyIs undefined ls-sec ] : null }
   { [ propertyIs '' ls-sec ] : null }
   { true (
    ; to norm-sec [ match
     { $normalizeClockShowSeconds : !normalizeClockShowSeconds $ls-sec }
     { [ propertyIs false ls-sec ] : false }
     { [ propertyIs 'false' ls-sec ] : false }
     { true : true }
    ]
    ; set $norm-sec scope.clock-show-seconds
   ) }
  ]
 ) }
]
; to lane-fs-enter-svg '<svg class="lane-fullscreen-icon lane-fullscreen-icon--enter" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5H13.5V6M13.5 10V13.5H10M6 13.5H2.5V10"></path></svg>'
; to lane-fs-exit-svg '<svg class="lane-fullscreen-icon lane-fullscreen-icon--exit" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6H6V2.5M10 2.5V6H13.5M13.5 10H10V13.5M6 13.5V10H2.5"></path></svg>'
; to config-modal !lane-config-modal.create $scope
; set $config-modal scope.config-modal
; to import-modal !lane-import-modal.create $scope
; set $import-modal scope.import-modal
; to table-import-modal !lane-import-modal.create-table-import $scope
; set $table-import-modal scope.table-import-modal
; to export-modal !lane-export-modal.create $scope
; set $export-modal scope.export-modal
; to export-deploy-modal !lane-export-deploy-modal.create $scope
; set $export-deploy-modal scope.export-deploy-modal
; to lane-modal !lane-modal-mod.create $scope
; set $lane-modal scope.lane-modal
; to confirm-modal !confirm-modal-mod.create $scope
; set $confirm-modal scope.confirm-modal
; to row-picker-modal !row-picker-modal-mod.create $scope
; set $row-picker-modal scope.row-picker-modal
; to session-modal !lane-session-modal-mod.create $scope
; set $session-modal scope.session-modal
; to package-modal !lane-package-modal-mod.create $scope
; set $package-modal scope.package-modal
; to dir-modal !lane-dir-modal-mod.create $scope
; set $dir-modal scope.dir-modal
; to line-info-modal !lane-line-info-mod.create $scope
; set $line-info-modal scope.line-info-modal
; to terminal-modal !lane-terminal-modal-mod.create $scope
; set $terminal-modal scope.terminal-modal
; to servers-modal !lane-servers-modal-mod.create $scope
; set $servers-modal scope.servers-modal
; to rails !lane-rails.create $scope
; set $rails scope.rails
; to fullscreen-el !document.createElement div
; assign $fullscreen-el { className lane-fullscreen } { hidden true }
!fullscreen-el.setAttribute role region
!fullscreen-el.setAttribute aria-label 'Fullscreen lane'
!fullscreen-el.setAttribute aria-hidden 'true'
!fullscreen-el.setAttribute data-lane-id ''
; to fullscreen-frame !document.createElement div
; set lane-fullscreen-frame fullscreen-frame.className
; to fullscreen-header !document.createElement div
; set 'lane-fullscreen-header lane-header' fullscreen-header.className
; to fullscreen-body !document.createElement div
; set 'lane-fullscreen-body lane-body' fullscreen-body.className
!fullscreen-frame.appendChild $fullscreen-header
!fullscreen-frame.appendChild $fullscreen-body
!fullscreen-el.appendChild $fullscreen-frame
[ match
 { $document.body : !document.body.appendChild $fullscreen-el }
]
; set $fullscreen-el scope.fullscreen-el
; set $fullscreen-frame scope.fullscreen-frame
; set $fullscreen-header scope.fullscreen-header
; set $fullscreen-body scope.fullscreen-body
; to copy-id-list (
 -- Returns a fresh shallow array copy of string IDs
 ; to { list } $argv
 ; to out {}
 [ match
  { $list (
   ; each $list (
    ; to { item } $argv
    !out.push $item
   )
  ) }
 ]
 $out
)
; to arrays-equal (
 -- Returns true when two arrays have identical length and element values in order
 ; to { a b } $argv
 ; to list-a [ match { $a : $a } { true : {} } ]
 ; to list-b [ match { $b : $b } { true : {} } ]
 [ match
  { [ propertyIs $list-a.length list-b.length ] (
   ; to diff ; object { found false }
   ; each $list-a (
    ; to { val idx } $argv
    ; to other [ get list-b $idx ]
    ; condition { propertyIs false [ propertyIs $val other ] } : ; set true diff.found
   )
   [ ternary $diff.found false true ]
  ) }
  { true : false }
 ]
)
; to filter-available-sessions (
 -- Returns only resolved session link entries that are currently available
 ; to { entries } $argv
 ; to out {}
 [ match
  { $entries (
   ; each $entries (
    ; to { item } $argv
    ; condition { propertyIs true item.available } : !out.push $item
   )
  ) }
 ]
 $out
)
; to scope.refresh-session-links (
 -- Resolves availability and live names of Previous and Next linked sessions and syncs the side-rail navigation tabs
 ; to seq ; add $scope.links-seq 1
 ; set $seq scope.links-seq
 ; to prev-resolved [ match
  { $resolveSessionLinks : !resolveSessionLinks $data $window $scope.previous-session-ids $scope.session-id }
  { true : {} }
 ]
 ; to next-resolved [ match
  { $resolveSessionLinks : !resolveSessionLinks $data $window $scope.next-session-ids $scope.session-id }
  { true : {} }
 ]
 ; condition { propertyIs $seq scope.links-seq } (
  ; set $prev-resolved scope.resolved-previous-sessions
  ; set $next-resolved scope.resolved-next-sessions
  ; set [ !filter-available-sessions $prev-resolved ] scope.available-previous-sessions
  ; set [ !filter-available-sessions $next-resolved ] scope.available-next-sessions
  [ match
   { $rails.sync-session-nav : !rails.sync-session-nav }
  ]
 )
 ; object { previous $scope.available-previous-sessions } { next $scope.available-next-sessions }
)
; to sync-session-ui (
 -- Refreshes top-rail session/packages menus, side-rail session nav tabs, open session/package modals, and the left workspace summary panel
 [ match
  { $rails.sync-session-menu : !rails.sync-session-menu }
 ]
 [ match
  { $rails.sync-packages-menu : !rails.sync-packages-menu }
 ]
 [ match
  { $scope.refresh-session-links : !scope.refresh-session-links }
 ]
 [ match
  { $scope.sync-workspace-summary : !scope.sync-workspace-summary }
 ]
 [ match
  { [ and { propertyIs true session-modal.is-open } { propertyIs history session-modal.mode } { $session-modal.render-history-page } ] : !session-modal.render-history-page }
  { [ and { propertyIs true session-modal.is-open } { $session-modal.render-session } ] : !session-modal.render-session }
 ]
 [ match
  { [ and { propertyIs true package-modal.is-open } { propertyIs packages package-modal.mode } { $package-modal.render-packages-page } ] : !package-modal.render-packages-page }
 ]
 [ match
  { $rails.sync-minimap : !rails.sync-minimap }
 ]
)

; to normalize-session-settings-obj (
 -- Normalizes a session settings object with safe defaults when storage helpers are absent
 ; to { raw } $argv
 [ match
  { $normalizeSessionSettings : !normalizeSessionSettings $raw }
  { true (
   ; to enabled [ match
    { [ propertyIs true raw.minimap ] : true }
    { [ propertyIs 'true' raw.minimap ] : true }
    { true : false }
   ]
   ; to scale [ match
    { $normalizeMinimapScale : !normalizeMinimapScale $raw.minimapScale 1 }
    { [ propertyIsGreaterThan 0 raw.minimapScale ] (
     [ match
      { $window.Math.max : !window.Math.max 0.5 [ !window.Math.min 2.5 $raw.minimapScale ] }
      { true : $raw.minimapScale }
     ]
    ) }
    { true : 1 }
   ]
   [ object { minimap $enabled } { minimapScale $scale } ]
  ) }
 ]
)
; to scope.recompute-session-dirty (
 -- Recomputes whether current lane routes (open lanes, order, tabs, selected data tables) or open packages differ from the session's last saved version (deferred while session-pending-count > 0)
 [ match
  { [ propertyIsGreaterThan 0 scope.session-pending-count ] (
   ; set true scope.session-status-pending
   !sync-session-ui
   $scope.session-dirty
  ) }
  { true (
   ; set false scope.session-status-pending
   ; set '' scope.session-status-label
   ; to cur-pathname !formatLaneRoutes $scope.lanes
   ; to saved-path [ match
    { $scope.saved-pathname : $scope.saved-pathname }
    { true : '/' }
   ]
   ; to routes-same [ propertyIs $cur-pathname saved-path ]
   ; to pkgs-same !arrays-equal $scope.open-package-ids $scope.saved-package-ids
   ; to display-opts-same [ match
    { $sessionTableDisplayOptionsEqual : !sessionTableDisplayOptionsEqual $scope.table-display-options $scope.saved-table-display-options }
    { true : true }
   ]
   ; to is-dirty [ match
    { [ propertyIs false routes-same ] : true }
    { [ propertyIs false pkgs-same ] : true }
    { [ propertyIs false display-opts-same ] : true }
    { true : false }
   ]
   ; set $is-dirty scope.session-dirty
   !sync-session-ui
   $is-dirty
  ) }
 ]
)
; to scope.begin-session-status-pending (
 -- Enters an intermediate pending session status state (e.g. Saving… or Loading…) that blocks navigation like unsaved without flashing Unsaved version until saved/unsaved state is known
 ; to { raw-label } $argv
 ; to label [ match
  { $raw-label : $raw-label }
  { [ propertyIs '' scope.session-status-label ] : 'Loading…' }
  { true : $scope.session-status-label }
 ]
 ; to next-count ; add $scope.session-pending-count 1
 ; set $next-count scope.session-pending-count
 ; set true scope.session-status-pending
 ; set $label scope.session-status-label
 !sync-session-ui
 $next-count
)
; to scope.end-session-status-pending (
 -- Completes a pending session/lane operation and recomputes accurate saved/unsaved session status once all pending operations settle
 ; to { skip-recompute } $argv
 ; to next-count [ match
  { [ propertyIsGreaterThan 1 scope.session-pending-count ] : ; subtract $scope.session-pending-count 1 }
  { true : 0 }
 ]
 ; set $next-count scope.session-pending-count
 [ match
  { [ propertyIs 0 next-count ] (
   ; set false scope.session-status-pending
   ; set '' scope.session-status-label
   [ match
    { $skip-recompute : !sync-session-ui }
    { true : !scope.recompute-session-dirty }
   ]
  ) }
 ]
 $next-count
)
; to scope.is-session-navigation-blocked (
 -- Returns true when session switching/creation should be blocked (either because the session has an unsaved version or because saved/unsaved status is currently pending)
 [ match
  { [ propertyIs true scope.session-status-pending ] : true }
  { [ propertyIs true scope.session-dirty ] : true }
  { true : false }
 ]
)
; to navigate-to-session-pathname (
 -- Updates browser URL pathname to the session's saved lane routes (including per-lane tabs and data tables) while preserving search and hash
 ; to { raw-pathname } $argv
 ; to pathname [ match
  { $raw-pathname : $raw-pathname }
  { true : '/' }
 ]
 ; to search [ match
  { $location.search : $location.search }
  { true : '' }
 ]
 ; to hash [ match
  { $location.hash : $location.hash }
  { true : '' }
 ]
 ; to url ; add [ ; add $pathname $search ] $hash
 [ match
  { [ propertyIs $location.pathname pathname ] : null }
  { true : !history.pushState null '' $url }
 ]
 $pathname
)
; to scope.apply-session-packages (
 -- Updates open packages and active package metadata on scope from a session record
 ; to { sess-rec } $argv
 [ match
  { $sess-rec (
   ; set $sess-rec.meta scope.session-meta
   ; set $sess-rec.openPackageIds scope.open-package-ids
   ; set $sess-rec.openPackages scope.open-packages
   ; set $sess-rec.activePackageId scope.active-package-id
  ) }
 ]
 $sess-rec
)
; to scope.format-data-dir-label (
 -- Formats a session data directory label using formatDataDirLabel with a safe fallback
 ; to { raw-dir confirmed } $argv
 [ match
  { $formatDataDirLabel : !formatDataDirLabel $raw-dir $confirmed }
  { $raw-dir : $raw-dir }
  { [ propertyIs true confirmed ] : Default }
  { true : 'Default (unconfirmed)' }
 ]
)
; to scope.is-session-dirs-disabled (
 -- Returns true when per-session directory selection is disabled on the server/client
 ; to from-helper [ match
  { $isSessionDirsDisabled : !isSessionDirsDisabled $data }
  { [ propertyIs true data.sessionDirsDisabled ] : true }
  { true : false }
 ]
 [ match
  { [ propertyIs true from-helper ] : true }
  { [ propertyIs true scope.session-dirs-disabled ] : true }
  { true : false }
 ]
)
; to scope.apply-session-state (
 -- Updates full session state and saved baseline on scope from storage session helper results
 ; to { sess } $argv
 [ match
  { $sess (
   ; set $sess.sessionId scope.session-id
   ; set $sess.browserSessionId scope.browser-session-id
   ; set [ ternary $sess.isOverridden true false ] scope.session-overridden
   ; to dirs-disabled !scope.is-session-dirs-disabled
   ; set $dirs-disabled scope.session-dirs-disabled
   ; to raw-dir [ match
    { [ propertyIs undefined sess.meta.dataDir ] : $sess.dataDir }
    { true : $sess.meta.dataDir }
   ]
   ; to norm-dir [ match
    { [ propertyIs true dirs-disabled ] : null }
    { $normalizeDataDir : !normalizeDataDir $raw-dir }
    { $raw-dir : $raw-dir }
    { true : null }
   ]
   ; to dir-confirmed [ match
    { [ propertyIs true dirs-disabled ] : true }
    { [ propertyIs true sess.meta.dataDirConfirmed ] : true }
    { [ propertyIs true sess.dataDirConfirmed ] : true }
    { $norm-dir : true }
    { true : false }
   ]
   ; set $norm-dir scope.session-data-dir
   ; set $dir-confirmed scope.session-data-dir-confirmed
   ; set $sess.recentSessions scope.recent-sessions
   [ match
    { $sess.sessionHistory : ; set $sess.sessionHistory scope.session-history }
   ]
   ; to base-lanes !copy-id-list $sess.laneIds
   ; to base-path [ match
    { $sess.pathname : $sess.pathname }
    { true : '/' }
   ]
   ; to base-pkgs !copy-id-list $sess.openPackageIds
   ; set $base-lanes scope.saved-lane-ids
   ; set $base-path scope.saved-pathname
   ; set $base-pkgs scope.saved-package-ids
   ; set $sess.activePackageId scope.saved-active-package-id
   ; to raw-disp-opts [ match
    { $sess.tableDisplayOptions : $sess.tableDisplayOptions }
    { $sess.meta.tableDisplayOptions : $sess.meta.tableDisplayOptions }
    { true : ; object }
   ]
   ; to cur-disp-opts [ match
    { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $raw-disp-opts }
    { true : ; object }
   ]
   ; to saved-disp-opts [ match
    { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $raw-disp-opts }
    { true : ; object }
   ]
   ; set $cur-disp-opts scope.table-display-options
   ; set $saved-disp-opts scope.saved-table-display-options
   ; to prev-ids [ match
    { $sess.previousSessionIds : !copy-id-list $sess.previousSessionIds }
    { $sess.meta.previousSessionIds : !copy-id-list $sess.meta.previousSessionIds }
    { true : {} }
   ]
   ; to next-ids [ match
    { $sess.nextSessionIds : !copy-id-list $sess.nextSessionIds }
    { $sess.meta.nextSessionIds : !copy-id-list $sess.meta.nextSessionIds }
    { true : {} }
   ]
   ; set $prev-ids scope.previous-session-ids
   ; set $next-ids scope.next-session-ids
   ; to raw-settings [ match
    { $sess.settings : $sess.settings }
    { $sess.meta.settings : $sess.meta.settings }
    { true : null }
   ]
   ; to norm-settings !normalize-session-settings-obj $raw-settings
   ; set $norm-settings scope.session-settings
   ; set [ ternary $norm-settings.minimap true false ] scope.session-minimap
   ; set $norm-settings.minimapScale scope.session-minimap-scale
   ; set false scope.session-dirty
   !scope.apply-session-packages $sess
  ) }
 ]
 $sess
)
; to scope.init-session (
 -- Initializes two-level browser/tab session state, migrates legacy catalog, and loads open packages
 [ match
  { $scope.session-init-tracker (
   ; to pending-tracker $scope.session-init-tracker
   !pending-tracker.whenIdle
   !pending-tracker.whenIdle
   $scope.last-session-init-result
  ) }
  { true (
   ; to tracker [ match { $createIdleTracker : !createIdleTracker } { true : null } ]
   ; to finish [ match { $tracker : !tracker.begin } { true : null } ]
   ; set $tracker scope.session-init-tracker
   ; to sess null
   ; try (
    ; set [ !initSessionState $data $window ] sess
    ; set $sess scope.last-session-init-result
    !scope.apply-session-state $sess
    !scope.load-catalog
    !sync-session-ui
   ) : null
   ; set null scope.session-init-tracker
   [ match
    { $finish : !$finish true }
   ]
   $sess
  ) }
 ]
)
; to scope.ensure-session (
 -- Lazily initializes session state if not yet loaded
 [ match
  { $scope.session-id : $scope.session-id }
  { true (
   !scope.init-session
   $scope.session-id
  ) }
 ]
)
; to scope.get-package-name (
 -- Resolves display name for a package ID from open session packages
 ; to { package-id } $argv
 ; to found ; object { name '' }
 ; each $scope.open-packages (
  ; to { pkg } $argv
  ; condition { propertyIs $package-id pkg.id } : ; set $pkg.name found.name
 )
 [ match
  { [ propertyIs '' found.name ] : $package-id }
  { true : $found.name }
 ]
)
; to refresh-after-session-change (
 -- Reloads catalog, optionally navigates URL to session lane routes, re-syncs lanes, recomputes dirty state, and applies preferences
 ; to { navigate-lanes } $argv
 !scope.begin-session-status-pending 'Loading…'
 ; set true scope.preferences-loading
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 ; try (
  !scope.load-catalog
  [ match
   { $navigate-lanes : !navigate-to-session-pathname $scope.saved-pathname }
  ]
  !scope.sync
 ) : null
 !scope.end-session-status-pending
 [ match
  { $scope.load-preferences-lane : !scope.load-preferences-lane }
  { true : ; set false scope.preferences-loading }
 ]
 ; set false scope.preferences-loading
 [ match
  { $scope.load-clock-timezone : !scope.load-clock-timezone }
 ]
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 !scope.apply-preferences
)
; to capture-previous-confirmed (
 -- Captures the active session ID and tab-override flag when already confirmed and distinct from target-id
 ; to { target-id } $argv
 [ match
  { [ propertyIs true scope.session-data-dir-confirmed ] (
   [ match
    { $scope.session-id (
     [ match
      { [ propertyIs $target-id scope.session-id ] : null }
      { true : ; object { id $scope.session-id } { was-tab $scope.session-overridden } }
     ]
    ) }
    { true : null }
   ]
  ) }
  { true : null }
 ]
)
; to maybe-prompt-confirm (
 -- Prompts data directory selection when switching to an unconfirmed session
 ; to { prev-info } $argv
 ; to dirs-disabled !scope.is-session-dirs-disabled
 [ match
  { [ and { propertyIs false dirs-disabled } { propertyIs false scope.session-data-dir-confirmed } ] (
   [ match
    { $prev-info.id : !dir-modal.open-confirm [ object { previous-session-id $prev-info.id } { previous-was-tab $prev-info.was-tab } ] }
    { true : !dir-modal.open-confirm }
   ]
  ) }
 ]
)
; to scope.confirm-session-data-dir (
 -- Permanently binds the active session to a computer folder (or confirms Default when null/empty)
 ; to { data-dir } $argv
 !scope.ensure-session
 !scope.begin-session-status-pending 'Loading…'
 ; to res null
 ; try (
  ; set [ !setSessionDataDir $data $window $scope.session-id [ object { dataDir $data-dir } ] ] res
  [ match
   { $res.ok (
    !scope.apply-session-state $res.session
    !refresh-after-session-change $res.dirChanged
   ) }
  ]
 ) : null
 !scope.end-session-status-pending
 $res
)
; to scope.prompt-new-session (
 -- Opens the computer directory picker modal in Create Session mode (or creates directly when directory selection is disabled)
 ; to { tab-only } $argv
 ; to dirs-disabled !scope.is-session-dirs-disabled
 [ match
  { [ propertyIs true scope.session-status-pending ] : null }
  { [ propertyIs true scope.session-dirty ] : !session-modal.open-switch-session }
  { [ propertyIs true dirs-disabled ] (
   [ match
    { $tab-only : !scope.new-tab-session '' null true }
    { true : !scope.new-session '' null true }
   ]
  ) }
  { true : !dir-modal.open-create [ object { tab-only [ ternary $tab-only true false ] } ] }
 ]
)
; to scope.new-session (
 -- Creates a new session (browser + tab by default), switches to it, and navigates to its lanes
 ; to { name data-dir confirmed } $argv
 !scope.begin-session-status-pending 'Loading…'
 ; to sess null
 ; try (
  ; to opts [ object { name $name } { tabOnly false } { dataDir $data-dir } { dataDirConfirmed $confirmed } ]
  ; set [ !createNewSession $data $window $opts ] sess
  !scope.apply-session-state $sess
  !refresh-after-session-change true
 ) : null
 !scope.end-session-status-pending
 ; to dirs-disabled !scope.is-session-dirs-disabled
 [ match
  { [ and { propertyIs false dirs-disabled } { propertyIs false scope.session-data-dir-confirmed } ] : !dir-modal.open-confirm }
 ]
 $sess
)
; to scope.switch-session (
 -- Switches active session (browser + tab), redirecting browser URL to that session's open lanes
 ; to { id } $argv
 !scope.begin-session-status-pending 'Loading…'
 ; to prev !capture-previous-confirmed $id
 ; to sess null
 ; try (
  ; set [ !switchBrowserSession $data $window $id ] sess
  !scope.apply-session-state $sess
  !refresh-after-session-change true
 ) : null
 !scope.end-session-status-pending
 !maybe-prompt-confirm $prev
 $sess
)
; to scope.new-tab-session (
 -- Creates a new tab-only session in sessionStorage without altering the localStorage browser session
 ; to { name data-dir confirmed } $argv
 !scope.begin-session-status-pending 'Loading…'
 ; to sess null
 ; try (
  ; to opts [ object { name $name } { dataDir $data-dir } { dataDirConfirmed $confirmed } ]
  ; set [ !createNewTabSession $data $window $opts ] sess
  !scope.apply-session-state $sess
  !refresh-after-session-change true
 ) : null
 !scope.end-session-status-pending
 ; to dirs-disabled !scope.is-session-dirs-disabled
 [ match
  { [ and { propertyIs false dirs-disabled } { propertyIs false scope.session-data-dir-confirmed } ] : !dir-modal.open-confirm }
 ]
 $sess
)
; to scope.switch-tab-session (
 -- Switches the active tab session in sessionStorage only and navigates to its lanes
 ; to { id } $argv
 !scope.begin-session-status-pending 'Loading…'
 ; to prev !capture-previous-confirmed $id
 ; to sess null
 ; try (
  ; set [ !switchTabSession $data $window $id ] sess
  !scope.apply-session-state $sess
  !refresh-after-session-change true
 ) : null
 !scope.end-session-status-pending
 !maybe-prompt-confirm $prev
 $sess
)
; to scope.return-to-browser-session (
 -- Clears the tab override, returns sessionStorage to the saved localStorage browser session, and navigates to its lanes
 !scope.begin-session-status-pending 'Loading…'
 ; to prev !capture-previous-confirmed $scope.browser-session-id
 ; to sess null
 ; try (
  ; set [ !returnToBrowserSession $data $window ] sess
  !scope.apply-session-state $sess
  !refresh-after-session-change true
 ) : null
 !scope.end-session-status-pending
 !maybe-prompt-confirm $prev
 $sess
)
; to scope.promote-tab-session (
 -- Promotes the current tab session ID to become the persistent localStorage browser session
 !scope.begin-session-status-pending 'Saving…'
 ; to sess null
 ; try (
  ; set [ !promoteTabToBrowserSession $data $window ] sess
  !scope.apply-session-state $sess
  !refresh-after-session-change false
 ) : null
 !scope.end-session-status-pending
 $sess
)
; to scope.switch-browser-session (
 -- Switches both the persistent localStorage browser session and active sessionStorage tab session and navigates to its lanes
 ; to { id } $argv
 !scope.begin-session-status-pending 'Loading…'
 ; to prev !capture-previous-confirmed $id
 ; to sess null
 ; try (
  ; set [ !switchBrowserSession $data $window $id ] sess
  !scope.apply-session-state $sess
  !refresh-after-session-change true
 ) : null
 !scope.end-session-status-pending
 !maybe-prompt-confirm $prev
 $sess
)
; to scope.save-session-draft (
 -- Commits current working lane routes (including tabs and selected data tables), table display options, and packages as the next saved version of the active session
 !scope.ensure-session
 !scope.begin-session-status-pending 'Saving…'
 ; to res null
 ; try (
  ; to cur-pathname !formatLaneRoutes $scope.lanes
  ; to cur-disp-opts [ match
   { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $scope.table-display-options }
   { true : $scope.table-display-options }
  ]
  ; to opts [ object
   { laneIds !copy-id-list $scope.lane-ids }
   { pathname $cur-pathname }
   { openPackageIds !copy-id-list $scope.open-package-ids }
   { activePackageId $scope.active-package-id }
   { tableDisplayOptions $cur-disp-opts }
   { settings [ !normalize-session-settings-obj $scope.session-settings ] }
   { incrementVersion true }
  ]
  ; set [ !saveSessionVersion $data $window $scope.session-id $opts ] res
  [ match
   { $res (
    ; set [ !copy-id-list $res.laneIds ] scope.saved-lane-ids
    ; set [ match { $res.pathname : $res.pathname } { true : $cur-pathname } ] scope.saved-pathname
    ; set [ !copy-id-list $res.openPackageIds ] scope.saved-package-ids
    ; set $res.activePackageId scope.saved-active-package-id
    ; to next-saved-disp [ match
     { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions [ match { $res.tableDisplayOptions : $res.tableDisplayOptions } { true : $cur-disp-opts } ] }
     { true : $cur-disp-opts }
    ]
    ; set $next-saved-disp scope.saved-table-display-options
    ; set [ match { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $next-saved-disp } { true : $next-saved-disp } ] scope.table-display-options
    ; set $res.recentSessions scope.recent-sessions
    [ match
     { $res.sessionHistory : ; set $res.sessionHistory scope.session-history }
    ]
    !scope.apply-session-packages $res
   ) }
  ]
 ) : null
 !scope.end-session-status-pending
 $res
)
; to scope.fork-session (
 -- Forks the current working lane routes (including tabs and selected data tables), table display options, and packages into a new session while leaving the original session at its last saved version
 ; to { name tab-only } $argv
 ; to sess null
 ; condition { propertyIs false scope.session-status-pending } (
  !scope.ensure-session
  !scope.begin-session-status-pending 'Saving…'
  ; try (
   ; to cur-pathname !formatLaneRoutes $scope.lanes
   ; to cur-disp-opts [ match
    { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $scope.table-display-options }
    { true : $scope.table-display-options }
   ]
   ; to opts [ object
    { name $name }
    { laneIds !copy-id-list $scope.lane-ids }
    { pathname $cur-pathname }
    { openPackageIds !copy-id-list $scope.open-package-ids }
    { activePackageId $scope.active-package-id }
    { tableDisplayOptions $cur-disp-opts }
    { settings [ !normalize-session-settings-obj $scope.session-settings ] }
    { tabOnly [ ternary $tab-only true false ] }
    { restoreSourcePackageIds !copy-id-list $scope.saved-package-ids }
    { restoreSourceActivePackageId $scope.saved-active-package-id }
   ]
   ; set [ !forkSession $data $window $scope.session-id $opts ] sess
   !scope.apply-session-state $sess
   !refresh-after-session-change true
  ) : null
  !scope.end-session-status-pending
 )
 $sess
)
; to scope.abandon-session-draft (
 -- Reverts working lane routes, table display options, and packages back to the session's last saved version and redirects URL
 !scope.ensure-session
 !scope.begin-session-status-pending 'Loading…'
 ; to res null
 ; try (
  ; to saved-disp-opts [ match
   { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $scope.saved-table-display-options }
   { true : $scope.saved-table-display-options }
  ]
  ; to opts [ object
   { laneIds !copy-id-list $scope.saved-lane-ids }
   { pathname $scope.saved-pathname }
   { openPackageIds !copy-id-list $scope.saved-package-ids }
   { activePackageId $scope.saved-active-package-id }
   { tableDisplayOptions $saved-disp-opts }
   { incrementVersion false }
  ]
  ; set [ !saveSessionVersion $data $window $scope.session-id $opts ] res
  [ match
   { $res (
    ; set [ !copy-id-list $res.laneIds ] scope.saved-lane-ids
    ; set [ match { $res.pathname : $res.pathname } { true : '/' } ] scope.saved-pathname
    ; set [ !copy-id-list $res.openPackageIds ] scope.saved-package-ids
    ; set $res.activePackageId scope.saved-active-package-id
    ; to restored-disp [ match
     { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions [ match { $res.tableDisplayOptions : $res.tableDisplayOptions } { true : $saved-disp-opts } ] }
     { true : $saved-disp-opts }
    ]
    ; set $restored-disp scope.saved-table-display-options
    ; set [ match { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $restored-disp } { true : $restored-disp } ] scope.table-display-options
    ; set $res.recentSessions scope.recent-sessions
    [ match
     { $res.sessionHistory : ; set $res.sessionHistory scope.session-history }
    ]
    !scope.apply-session-packages $res
   ) }
  ]
  !refresh-after-session-change true
 ) : null
 !scope.end-session-status-pending
 $res
)
; to scope.get-visible-subtables (
 -- Returns the list of visible subtable IDs for a given lane and table in the active session
 ; to { lane-id table-id } $argv
 ; to clean-lane [ match { $lane-id : ; add '' $lane-id } { true : '' } ]
 ; to clean-tbl [ match { $table-id : ; add '' $table-id } { true : '' } ]
 [ match
  { [ and { $clean-lane } { $clean-tbl } ] (
   ; to key ; add $clean-lane ; add ':' $clean-tbl
   ; to list [ get scope.table-display-options $key ]
   [ match
    { [ !window.Array.isArray $list ] : !copy-id-list $list }
    { true : {} }
   ]
  ) }
  { true : {} }
 ]
)
; to scope.is-subtable-visible (
 -- Returns true when a subtable is toggled visible under the given lane and table in the active session
 ; to { lane-id table-id subtable-id } $argv
 ; to list !scope.get-visible-subtables $lane-id $table-id
 ; to clean-sub [ match { $subtable-id : ; add '' $subtable-id } { true : '' } ]
 [ match
  { [ propertyIs '' clean-sub ] : false }
  { true : !list.includes $clean-sub }
 ]
)
; to scope.set-subtable-visible (
 -- Sets or toggles visibility of an inbound subtable for a lane table in the active session and marks the session dirty if changed
 ; to { lane-id table-id subtable-id visible } $argv
 !scope.ensure-session
 ; to clean-lane [ match { $lane-id : ; add '' $lane-id } { true : '' } ]
 ; to clean-tbl [ match { $table-id : ; add '' $table-id } { true : '' } ]
 ; to clean-sub [ match { $subtable-id : ; add '' $subtable-id } { true : '' } ]
 [ match
  { [ and { $clean-lane } { $clean-tbl } { $clean-sub } ] (
   ; to key ; add $clean-lane ; add ':' $clean-tbl
   ; to cur-list !scope.get-visible-subtables $clean-lane $clean-tbl
   ; to was-vis !cur-list.includes $clean-sub
   ; to next-vis [ match
    { [ propertyIs undefined visible ] : [ ternary $was-vis false true ] }
    { [ propertyIs null visible ] : [ ternary $was-vis false true ] }
    { true : [ ternary $visible true false ] }
   ]
   ; to next-list {}
   ; each $cur-list (
    ; to { item } $argv
    ; to is-same [ propertyIs $clean-sub item ]
    ; condition { propertyIs false is-same } : !next-list.push $item
   )
   ; condition { propertyIs true next-vis } : !next-list.push $clean-sub
   ; to next-map ; object
   [ match
    { $scope.table-display-options : ; assign $next-map $scope.table-display-options }
   ]
   [ match
    { [ propertyIsGreaterThan 0 next-list.length ] : ; to next-map $key $next-list }
    { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $next-map $key }
    { true : ; to next-map $key {} }
   ]
   ; to normalized [ match
    { $normalizeSessionTableDisplayOptions : !normalizeSessionTableDisplayOptions $next-map }
    { true : $next-map }
   ]
   ; set $normalized scope.table-display-options
   !scope.recompute-session-dirty
   $next-vis
  ) }
  { true : false }
 ]
)
; to scope.toggle-subtable-visible (
 -- Toggles visibility of an inbound subtable for a lane table in the active session and marks the session dirty
 ; to { lane-id table-id subtable-id } $argv
 !scope.set-subtable-visible $lane-id $table-id $subtable-id null
)
; to scope.rename-session (
 -- Renames the active session in KV, recent sessions, and session history
 ; to { name } $argv
 !scope.ensure-session
 ; to res !renameSession $data $window $scope.session-id $name
 [ match
  { $res (
   ; set $res.meta scope.session-meta
   ; set $res.recentSessions scope.recent-sessions
   [ match
    { $res.sessionHistory : ; set $res.sessionHistory scope.session-history }
   ]
  ) }
 ]
 !sync-session-ui
 $res
)
; to scope.set-session-links (
 -- Saves Previous and Next navigation session IDs for the active session and refreshes availability and side rails
 ; to { prev-ids next-ids } $argv
 !scope.ensure-session
 ; to opts [ object { previousSessionIds $prev-ids } { nextSessionIds $next-ids } ]
 ; to res !setSessionLinks $data $window $scope.session-id $opts
 [ match
  { $res.ok (
   ; set $res.meta scope.session-meta
   ; set [ !copy-id-list $res.previousSessionIds ] scope.previous-session-ids
   ; set [ !copy-id-list $res.nextSessionIds ] scope.next-session-ids
  ) }
 ]
 !sync-session-ui
 $res
)
; to scope.add-previous-session (
 -- Adds a target session ID to the active session's Previous destinations
 ; to { target-id } $argv
 !scope.ensure-session
 ; to next-prev !copy-id-list $scope.previous-session-ids
 !next-prev.push $target-id
 !scope.set-session-links $next-prev $scope.next-session-ids
)
; to scope.remove-previous-session (
 -- Removes a target session ID from the active session's Previous destinations
 ; to { target-id } $argv
 !scope.ensure-session
 ; to filtered {}
 ; each $scope.previous-session-ids (
  ; to { id } $argv
  ; to is-same [ propertyIs $target-id id ]
  ; condition { propertyIs false is-same } : !filtered.push $id
 )
 !scope.set-session-links $filtered $scope.next-session-ids
)
; to scope.add-next-session (
 -- Adds a target session ID to the active session's Next destinations
 ; to { target-id } $argv
 !scope.ensure-session
 ; to next-list !copy-id-list $scope.next-session-ids
 !next-list.push $target-id
 !scope.set-session-links $scope.previous-session-ids $next-list
)
; to scope.remove-next-session (
 -- Removes a target session ID from the active session's Next destinations
 ; to { target-id } $argv
 !scope.ensure-session
 ; to filtered {}
 ; each $scope.next-session-ids (
  ; to { id } $argv
  ; to is-same [ propertyIs $target-id id ]
  ; condition { propertyIs false is-same } : !filtered.push $id
 )
 !scope.set-session-links $scope.previous-session-ids $filtered
)
; to scope.preview-minimap-scale (
 -- Updates the live minimap scale in memory during interactive dragging without persisting to KV
 ; to { raw-scale } $argv
 ; to next-scale [ match
  { $normalizeMinimapScale : !normalizeMinimapScale $raw-scale $scope.session-minimap-scale }
  { [ propertyIsGreaterThan 0 raw-scale ] : $raw-scale }
  { true : $scope.session-minimap-scale }
 ]
 ; to next-settings !normalize-session-settings-obj [ object { minimap $scope.session-minimap } { minimapScale $next-scale } ]
 ; set $next-settings scope.session-settings
 ; set $next-settings.minimapScale scope.session-minimap-scale
 [ match
  { $rails.sync-minimap : !rails.sync-minimap }
 ]
 $next-settings.minimapScale
)
; to scope.set-session-settings (
 -- Updates and persists session settings in KV without marking the session draft dirty
 ; to { patch } $argv
 !scope.ensure-session
 ; to merged ; object
 [ match
  { $scope.session-settings : ; assign $merged $scope.session-settings }
 ]
 [ match
  { $patch : ; assign $merged $patch }
 ]
 ; to optimistic !normalize-session-settings-obj $merged
 ; set $optimistic scope.session-settings
 ; set $optimistic.minimap scope.session-minimap
 ; set $optimistic.minimapScale scope.session-minimap-scale
 [ match
  { $rails.sync-minimap : !rails.sync-minimap }
 ]
 ; to res [ match
  { $setSessionSettings : !setSessionSettings $data $window $scope.session-id $optimistic }
  { true : ; object { ok true } { settings $optimistic } }
 ]
 [ match
  { $res.ok (
   [ match
    { $res.meta : ; set $res.meta scope.session-meta }
   ]
   ; to norm !normalize-session-settings-obj [ match
    { $res.settings : $res.settings }
    { true : $optimistic }
   ]
   ; set $norm scope.session-settings
   ; set $norm.minimap scope.session-minimap
   ; set $norm.minimapScale scope.session-minimap-scale
  ) }
 ]
 !sync-session-ui
 $res
)
; to scope.set-session-minimap (
 -- Enables or disables the workspace minimap for the active session
 ; to { enabled } $argv
 !scope.set-session-settings [ object { minimap [ ternary $enabled true false ] } ]
)
; to scope.toggle-session-minimap (
 -- Toggles the workspace minimap for the active session
 ; to next-val [ ternary [ propertyIs true scope.session-minimap ] false true ]
 !scope.set-session-minimap $next-val
)
; to scope.set-session-minimap-scale (
 -- Updates and persists the minimap scale factor for the active session
 ; to { raw-scale } $argv
 ; to next-scale [ match
  { $normalizeMinimapScale : !normalizeMinimapScale $raw-scale $scope.session-minimap-scale }
  { [ propertyIsGreaterThan 0 raw-scale ] : $raw-scale }
  { true : $scope.session-minimap-scale }
 ]
 !scope.set-session-settings [ object { minimapScale $next-scale } ]
)
; to scope.step-session-minimap-scale (
 -- Steps the active session minimap scale by delta-steps and persists it
 ; to { delta-steps } $argv
 ; to steps [ match
  { [ propertyIs undefined delta-steps ] : 1 }
  { [ propertyIs null delta-steps ] : 1 }
  { true : $delta-steps }
 ]
 ; to next-scale [ match
  { $stepMinimapScale : !stepMinimapScale $scope.session-minimap-scale $steps }
  { true (
   ; to raw ; add $scope.session-minimap-scale [ ; multiply $steps 0.25 ]
   [ match
    { $window.Math.max : !window.Math.max 0.5 [ !window.Math.min 2.5 $raw ] }
    { true : $raw }
   ]
  ) }
 ]
 !scope.set-session-minimap-scale $next-scale
)
; to scope.list-available-sessions (
 -- Returns all currently available sessions (excluding the active session) for navigation pickers
 !scope.ensure-session
 [ match
  { $listAvailableSessions : !listAvailableSessions $data $window $scope.session-id }
  { true : {} }
 ]
)
; to scope.create-package (
 -- Creates a new optionally passphrase-protected package and opens it in the active session (marking draft dirty)
 ; to { name passphrase } $argv
 !scope.ensure-session
 !scope.begin-session-status-pending 'Saving…'
 ; to res null
 ; try (
  ; to opts [ object { name $name } { passphrase $passphrase } ]
  ; set [ !createPackage $data $scope.session-id $opts $window ] res
  [ match
   { $res.sessionState : !scope.apply-session-packages $res.sessionState }
  ]
  !scope.load-catalog
 ) : null
 !scope.end-session-status-pending
 $res
)
; to refresh-pending-export-lanes (
 -- Re-runs mounted notebooks whose staged export rows now have all required packages open
 ; to rerun-lanes {}
 ; each $scope.lanes (
  ; to { lane } $argv
  ; condition { and { [ propertyIs false lane.is-locked ] } { $lane.notebook.rows } } (
   ; to needs-rerun ; object { hit false }
   ; each $lane.notebook.rows (
    ; to { r } $argv
    ; condition { and { [ propertyIs export r.kind ] } { [ propertyIs true r.pending-unlock ] } } (
     ; to all-satisfied ; object { val true }
     [ match
      { $r.locked-packages (
       ; each $r.locked-packages (
        ; to { lp } $argv
        ; to is-open-now [ !scope.open-package-ids.includes $lp.packageId ]
        ; condition { propertyIs false is-open-now } : ; set false all-satisfied.val
       )
      ) }
     ]
     ; condition { propertyIs true all-satisfied.val } : ; set true needs-rerun.hit
    )
   )
   ; condition { propertyIs true needs-rerun.hit } : !rerun-lanes.push $lane
  )
 )
 ; each $rerun-lanes (
  ; to { rlane } $argv
  [ match
   { $rlane.notebook.run : !rlane.notebook.run null false null [ object { trigger export-unlock } ] }
  ]
 )
 !scope.refresh-export-statuses
)
; to scope.open-package (
 -- Opens a package (verifying passphrase if required) in the active session and unlocks any locked mounted lanes
 ; to { package-id passphrase set-active } $argv
 !scope.ensure-session
 !scope.begin-session-status-pending 'Loading…'
 ; to res null
 ; to unlocked-lanes ; object { hit false }
 ; try (
  ; to should-activate [ match
   { [ propertyIs false set-active ] : false }
   { true : true }
  ]
  ; to opts [ object { packageId $package-id } { passphrase $passphrase } { setActive $should-activate } ]
  ; set [ !openPackageInSession $data $scope.session-id $opts $window ] res
  [ match
   { $res.ok (
    !scope.apply-session-packages $res.sessionState
    !scope.load-catalog
    !scope.refresh-lane-labels
    ; each $scope.lanes (
     ; to { lane } $argv
     ; condition { propertyIs true lane.is-locked } : ; set true unlocked-lanes.hit
    )
    [ match
     { $unlocked-lanes.hit : !scope.sync }
    ]
    ; condition { propertyIs false scope.unlocking-export-packages } : !refresh-pending-export-lanes
   ) }
  ]
 ) : null
 !scope.end-session-status-pending
 [ match
  { $unlocked-lanes.hit : !scope.apply-preferences }
 ]
 $res
)
; to scope.close-package (
 -- Closes a package in the active session and immediately enforces lock access control on open lanes
 ; to { package-id } $argv
 !scope.ensure-session
 !scope.begin-session-status-pending 'Loading…'
 ; to sess-rec null
 ; try (
  ; set [ !closePackageInSession $data $scope.session-id $package-id ] sess-rec
  !scope.apply-session-packages $sess-rec
  !refresh-after-session-change false
 ) : null
 !scope.end-session-status-pending
 $sess-rec
)
; to scope.set-active-package (
 -- Sets the active target package for new lanes created with + Lane
 ; to { package-id } $argv
 !scope.ensure-session
 ; to sess-rec !setActivePackageInSession $data $scope.session-id $package-id
 !scope.apply-session-packages $sess-rec
 !sync-session-ui
 $sess-rec
)
; to scope.move-lane-package (
 -- Moves a lane between packages and updates catalog and open views
 ; to { id next-package-id } $argv
 !scope.ensure-session
 !scope.begin-session-status-pending 'Saving…'
 ; to entry null
 ; try (
  ; to lane [ get scope.by-id $id ]
  ; to from-pkg [ match
   { $lane.package-id : $lane.package-id }
   { true : !getLanePackageId $data $id }
  ]
  ; to title [ match
   { $lane.title : $lane.title }
   { true : $id }
  ]
  ; set [ !moveLaneToPackage $data $id $title $from-pkg $next-package-id ] entry
  [ match
   { $lane : ; set $entry.packageId lane.package-id }
  ]
  !scope.load-catalog
  ; to still-open [ !scope.open-package-ids.includes $entry.packageId ]
  [ match
   { [ propertyIs false still-open ] : !scope.sync }
  ]
 ) : null
 !scope.end-session-status-pending
 $entry
)
; to scope.format-agent-context (
 -- Formats concise session, optional lane, and optional line context for pasting to a coding agent
 ; to { lane-or-opts maybe-line } $argv
 !scope.ensure-session
 ; to sid $scope.session-id
 ; to sname [ match
  { $scope.session-meta.name : $scope.session-meta.name }
  { $sid : $sid }
  { true : Session }
 ]
 ; to dir-confirmed [ propertyIs true scope.session-data-dir-confirmed ]
 ; to cur-pathname !formatLaneRoutes $scope.lanes
 ; to is-line-first [ match
  { $lane-or-opts.line-number : true }
  { $lane-or-opts.lineNumber : true }
  { $lane-or-opts.line-id : true }
  { $lane-or-opts.lineId : true }
  { true : false }
 ]
 ; to line-info [ match
  { $maybe-line : $maybe-line }
  { $is-line-first : $lane-or-opts }
  { $lane-or-opts.line : $lane-or-opts.line }
  { true : null }
 ]
 ; to raw-lane [ match
  { $is-line-first : $lane-or-opts.lane }
  { true : $lane-or-opts }
 ]
 ; to lane [ match
  { $raw-lane.id : $raw-lane }
  { [ and { $raw-lane } { $scope.resolve-lane } ] : !scope.resolve-lane $raw-lane }
  { $line-info.lane.id : $line-info.lane }
  { [ and { $line-info.lane-id } { $scope.resolve-lane } ] : !scope.resolve-lane $line-info.lane-id }
  { [ and { $line-info.laneId } { $scope.resolve-lane } ] : !scope.resolve-lane $line-info.laneId }
  { true : null }
 ]
 ; to lane-id [ match
  { $lane.id : $lane.id }
  { $line-info.lane-id : $line-info.lane-id }
  { $line-info.laneId : $line-info.laneId }
  { true : '' }
 ]
 ; to lane-title [ match
  { $lane.title : $lane.title }
  { [ and { $lane-id } { $scope.get-lane-title } ] : !scope.get-lane-title $lane-id }
  { true : '' }
 ]
 ; to lane-pkg [ match { $lane.package-id : $lane.package-id } { true : '' } ]
 ; to lane-path [ match { $lane.path : $lane.path } { $lane.tab : $lane.tab } { true : '' } ]
 ; to sb [ match
  { $line-info.lineSetBy : $line-info.lineSetBy }
  { $line-info.set-by : $line-info.set-by }
  { $line-info.setBy : $line-info.setBy }
  { true : null }
 ]
 ; to sb-title [ match
  { $line-info.lineSetByTitle : $line-info.lineSetByTitle }
  { $line-info.set-by-title : $line-info.set-by-title }
  { [ and { $sb.laneId } { $scope.get-lane-title } ] : !scope.get-lane-title $sb.laneId }
  { true : '' }
 ]
 ; to dirs-disabled !scope.is-session-dirs-disabled
 [ match
  { $formatAgentContext (
   !formatAgentContext [ object
    { sessionId $sid }
    { sessionName $sname }
    { dataDir $scope.session-data-dir }
    { dataDirConfirmed $dir-confirmed }
    { sessionDirsDisabled $dirs-disabled }
    { openPackages $scope.open-packages }
    { openPackageIds $scope.open-package-ids }
    { activePackageId $scope.active-package-id }
    { laneId $lane-id }
    { laneTitle $lane-title }
    { lanePackageId $lane-pkg }
    { lanePath $lane-path }
    { line $line-info }
    { lineSetByTitle $sb-title }
    { openLanes $scope.lanes }
    { pathname $cur-pathname }
    { clockDisplayOptions !scope.get-clock-display-options }
   ]
  ) }
  { true (
   ; to dir-label !scope.format-data-dir-label $scope.session-data-dir $dir-confirmed
   ; to base [ match
    { $dirs-disabled : ; add 'Civil Command Agent Context\nSession: ' ; add $sname ; add ' (' ; add $sid ')' }
    { true : ; add 'Civil Command Agent Context\nSession: ' ; add $sname ; add ' (' ; add $sid ; add ')\nData Directory (basePath): ' $dir-label }
   ]
   ; to with-lane [ match
    { $lane-id : ; add $base ; add '\nLane: ' ; add $lane-title ; add ' (' ; add $lane-id ')' }
    { true : $base }
   ]
   ; to line-num [ match { $line-info.lineNumber : $line-info.lineNumber } { $line-info.line-number : $line-info.line-number } { true : null } ]
   ; to line-id [ match { $line-info.lineId : $line-info.lineId } { $line-info.line-id : $line-info.line-id } { true : '' } ]
   ; to with-line [ match
    { $line-num (
     ; to lid-lbl [ match { [ propertyIs '' line-id ] : '(unsaved)' } { true : $line-id } ]
     ; to l-hdr [ match { [ propertyIs '' line-id ] : [ ; add '#' $line-num ] } { true : [ ; add '#' ; add $line-num ; add ' (' ; add $line-id ')' ] } ]
     ; add $with-lane ; add '\nLine: ' ; add $l-hdr ; add '\nLine ID: ' $lid-lbl
    ) }
    { true : $with-lane }
   ]
   ; add $with-line ; add '\nRoute: ' $cur-pathname
  ) }
 ]
)
; to scope.format-agent-prompt (
 -- Formats a ready-to-paste agent prompt wrapping the Civil Command Agent Context block
 ; to { lane-or-opts maybe-line } $argv
 ; to context-block !scope.format-agent-context $lane-or-opts $maybe-line
 [ match
  { $formatAgentPrompt : !formatAgentPrompt $context-block }
  { true : ; add 'Read @AGENTS.md and use `./cc` to inspect my workspace:\n\n' ; add $context-block '\n\nTask: ' }
 ]
)
; to scope.copy-agent-context (
 -- Copies formatted session, optional lane, and optional line context prompt to the clipboard
 ; to { lane-or-opts maybe-line } $argv
 ; to text !scope.format-agent-prompt $lane-or-opts $maybe-line
 [ match
  { $window.navigator.clipboard.writeText : !window.navigator.clipboard.writeText $text }
 ]
 $text
)
; to scope.mount-workspace-summary (
 -- Mounts separate Session and Packages cards into the left workspace column below + Lane / Open
 ; to { host-el } $argv
 [ match
  { $host-el (
   ; to panel !document.createElement div
   ; set workspace-side-stack panel.className
   ; to sess-sec !document.createElement div
   ; set 'workspace-session-panel workspace-session-card' sess-sec.className

   ; to sess-hdr !document.createElement div
   ; set workspace-session-header sess-hdr.className
   ; to sess-name-btn !document.createElement button
   ; assign $sess-name-btn { type button } { className workspace-session-name } { textContent Session } { title 'Open session switcher' }
   ; to sess-ver !document.createElement span
   ; assign $sess-ver { className workspace-session-ver } { textContent v1 }
   !sess-hdr.appendChild $sess-name-btn
   !sess-hdr.appendChild $sess-ver

   ; to sess-id-el !document.createElement div
   ; assign $sess-id-el { className workspace-session-id } { textContent '' }

   ; to sess-dir-btn !document.createElement button
   ; assign $sess-dir-btn { type button } { className workspace-session-dir } { textContent Default } { title 'Permanent session data directory' }

   ; to draft-box !document.createElement div
   ; assign $draft-box { className workspace-session-draft } { hidden true }
   ; to draft-lbl !document.createElement div
   ; assign $draft-lbl { className workspace-session-draft-label } { textContent 'Unsaved version' }
   ; to draft-acts !document.createElement div
   ; set workspace-session-draft-actions draft-acts.className
   ; to draft-save-btn !document.createElement button
   ; assign $draft-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
   ; to draft-fork-btn !document.createElement button
   ; assign $draft-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
   ; to draft-abandon-btn !document.createElement button
   ; assign $draft-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent Abandon }
   !draft-acts.appendChild $draft-save-btn
   !draft-acts.appendChild $draft-fork-btn
   !draft-acts.appendChild $draft-abandon-btn
   !draft-box.appendChild $draft-lbl
   !draft-box.appendChild $draft-acts

   ; to quick-row !document.createElement div
   ; set workspace-session-quick quick-row.className
   ; to quick-switch-btn !document.createElement button
   ; assign $quick-switch-btn { type button } { className workspace-mini-btn } { textContent Switch }
   ; to quick-fork-btn !document.createElement button
   ; assign $quick-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
   ; to quick-history-btn !document.createElement button
   ; assign $quick-history-btn { type button } { className workspace-mini-btn } { textContent History }
   ; to quick-copy-btn !document.createElement button
   ; assign $quick-copy-btn { type button } { className workspace-mini-btn } { textContent 'Copy Info' } { title 'Copy session & open lanes context for an agent' }
   !quick-row.appendChild $quick-switch-btn
   !quick-row.appendChild $quick-fork-btn
   !quick-row.appendChild $quick-history-btn
   !quick-row.appendChild $quick-copy-btn

   !sess-sec.appendChild $sess-hdr
   !sess-sec.appendChild $sess-id-el
   !sess-sec.appendChild $sess-dir-btn
   !sess-sec.appendChild $draft-box
   !sess-sec.appendChild $quick-row

   ; to pkg-sec !document.createElement div
   ; set 'workspace-session-panel workspace-packages-card' pkg-sec.className
   ; to pkg-hdr !document.createElement div
   ; set workspace-session-header pkg-hdr.className
   ; to pkg-title !document.createElement span
   ; assign $pkg-title { className workspace-section-label } { textContent Packages }
   ; to pkg-add-btn !document.createElement button
   ; assign $pkg-add-btn { type button } { className workspace-mini-btn } { textContent '+' } { title 'Manage or add packages' }
   !pkg-hdr.appendChild $pkg-title
   !pkg-hdr.appendChild $pkg-add-btn

   ; to pkg-loading-el !document.createElement div
   ; assign $pkg-loading-el { className 'cc-loading cc-loading--compact' } { textContent 'Loading packages…' } { hidden true }
   ; to pkg-list !document.createElement div
   ; set workspace-pkg-list pkg-list.className
   !pkg-sec.appendChild $pkg-hdr
   !pkg-sec.appendChild $pkg-loading-el
   !pkg-sec.appendChild $pkg-list

   !panel.appendChild $sess-sec
   !panel.appendChild $pkg-sec
   !host-el.appendChild $panel

   !sess-name-btn.addEventListener click : !session-modal.open-switch-session
   !sess-dir-btn.addEventListener click (
    ; to dirs-disabled !scope.is-session-dirs-disabled
    [ match
     { [ and { propertyIs false dirs-disabled } { propertyIs false scope.session-data-dir-confirmed } ] : !dir-modal.open-confirm }
     { true : !session-modal.open-switch-session }
    ]
   )
   !draft-save-btn.addEventListener click : !scope.save-session-draft
   !draft-fork-btn.addEventListener click : !scope.fork-session
   !draft-abandon-btn.addEventListener click : !scope.abandon-session-draft
   !quick-switch-btn.addEventListener click : !session-modal.open-switch-session
   !quick-fork-btn.addEventListener click : !scope.fork-session
   !quick-history-btn.addEventListener click : !session-modal.open-history

   ; to summary [ object
    { panel $panel }
    { session-card $sess-sec }
    { packages-card $pkg-sec }
    { sess-name-btn $sess-name-btn }
    { sess-ver $sess-ver }
    { sess-id-el $sess-id-el }
    { sess-dir-btn $sess-dir-btn }
    { draft-box $draft-box }
    { draft-lbl $draft-lbl }
    { draft-acts $draft-acts }
    { draft-save-btn $draft-save-btn }
    { draft-fork-btn $draft-fork-btn }
    { draft-abandon-btn $draft-abandon-btn }
    { quick-switch-btn $quick-switch-btn }
    { quick-fork-btn $quick-fork-btn }
    { quick-history-btn $quick-history-btn }
    { quick-copy-btn $quick-copy-btn }
    { copy-timer null }
    { pkg-add-btn $pkg-add-btn }
    { pkg-loading-el $pkg-loading-el }
    { pkg-list $pkg-list }
    { pkg-els {} }
    { pkg-items {} }
   ]
   !quick-copy-btn.addEventListener click (
    !scope.copy-agent-context
    ; set Copied quick-copy-btn.textContent
    [ match
     { $window.setTimeout (
      [ match
       { $summary.copy-timer : !window.clearTimeout $summary.copy-timer }
      ]
      ; to next-timer !window.setTimeout (
       ; set 'Copy Info' quick-copy-btn.textContent
       ; set null summary.copy-timer
      ) 1200
      ; set $next-timer summary.copy-timer
     ) }
    ]
   )
   !pkg-add-btn.addEventListener click : !package-modal.open-packages
   ; set $summary scope.workspace-summary
   !scope.sync-workspace-summary
   $summary
  ) }
 ]
)
; to scope.sync-workspace-summary (
 -- Updates the left workspace Session & Packages summary card with current session info, draft state, and included packages
 ; to summary $scope.workspace-summary
 [ match
  { $summary (
   ; to sid $scope.session-id
   ; to has-session [ match { $sid : true } { true : false } ]
   ; to pending [ propertyIs true scope.session-status-pending ]
   ; to dirty [ and { propertyIs false pending } { propertyIs true scope.session-dirty } ]
   ; to sname [ match
    { $scope.session-meta.name : $scope.session-meta.name }
    { $sid : $sid }
    { $pending : 'Loading…' }
    { true : Session }
   ]
   ; to ver [ match
    { $scope.session-meta.version : ; add v $scope.session-meta.version }
    { $has-session : v1 }
    { $pending : '' }
    { true : v1 }
   ]
   ; to pending-lbl [ match
    { [ propertyIs '' scope.session-status-label ] : 'Loading…' }
    { $scope.session-status-label : $scope.session-status-label }
    { true : 'Loading…' }
   ]
   ; to ver-txt [ match
    { [ and { $pending } { [ propertyIs '' ver ] } ] : '' }
    { $pending : ; add $ver ' …' }
    { $dirty : ; add $ver '*' }
    { true : $ver }
   ]
   ; set $sname summary.sess-name-btn.textContent
   ; set $ver-txt summary.sess-ver.textContent
   ; to short-id [ match
    { $sid (
     [ match
      { $sid.slice : !sid.slice 0 8 }
      { true : $sid }
     ]
    ) }
    { true : '' }
   ]
   ; to meta-line [ match
    { [ propertyIs true scope.session-overridden ] : ; add $short-id ' · tab' }
    { true : $short-id }
   ]
   ; set $meta-line summary.sess-id-el.textContent
   ; set [ match { $sid : $sid } { true : '' } ] summary.sess-id-el.title
   ; to dirs-disabled !scope.is-session-dirs-disabled
   ; to dir-confirmed [ propertyIs true scope.session-data-dir-confirmed ]
   ; to dir-label !scope.format-data-dir-label $scope.session-data-dir $dir-confirmed
   ; to dir-title [ match
    { $dir-confirmed : ; add 'Permanent data directory: ' $dir-label }
    { true : 'Data directory not yet confirmed — click to choose or confirm Default' }
   ]
   ; set $dir-label summary.sess-dir-btn.textContent
   ; set $dir-title summary.sess-dir-btn.title
   ; set [ ternary $dir-confirmed workspace-session-dir 'workspace-session-dir workspace-session-dir--unconfirmed' ] summary.sess-dir-btn.className
   ; set [ match { [ and { [ propertyIs false has-session ] } { $pending } ] : true } { true : $dirs-disabled } ] summary.sess-dir-btn.hidden
   ; to show-draft [ match { $pending : true } { $dirty : true } { true : false } ]
   ; set [ ternary $show-draft false true ] summary.draft-box.hidden
   ; set [ ternary $pending 'workspace-session-draft workspace-session-draft--pending' workspace-session-draft ] summary.draft-box.className
   ; set [ ternary $pending $pending-lbl 'Unsaved version' ] summary.draft-lbl.textContent
   ; set $pending summary.draft-acts.hidden
   ; set $pending summary.quick-fork-btn.disabled

   ; while { propertyIsGreaterThan 0 summary.pkg-els.length } (
    ; to old !summary.pkg-els.pop
    !old.remove
   )
   ; set 0 summary.pkg-items.length

   ; to pkgs [ match
    { $scope.open-packages : $scope.open-packages }
    { true : {} }
   ]
   [ match
    { $summary.pkg-loading-el : ; set [ ternary [ and { [ propertyIs false has-session ] } { $pending } { [ propertyIs 0 pkgs.length ] } ] false true ] summary.pkg-loading-el.hidden }
   ]
   ; each $pkgs (
    ; to { pkg } $argv
    ; to row !document.createElement div
    ; to is-act [ propertyIs $scope.active-package-id pkg.id ]
    ; set [ ternary $is-act 'workspace-pkg-row workspace-pkg-row--active' workspace-pkg-row ] row.className
    ; to dot-btn !document.createElement button
    ; assign $dot-btn { type button } { className workspace-pkg-dot } { textContent [ ternary $is-act '●' '○' ] } { title [ ternary $is-act 'Active package for new lanes' 'Set as active package' ] }
    !dot-btn.addEventListener click : !scope.set-active-package $pkg.id
    ; to name-btn !document.createElement button
    ; assign $name-btn { type button } { className workspace-pkg-name } { textContent $pkg.name } { title [ ; add 'Open package page: ' $pkg.name ] }
    !name-btn.addEventListener click : !package-modal.open-packages $pkg.id
    !row.appendChild $dot-btn
    !row.appendChild $name-btn
    !summary.pkg-list.appendChild $row
    !summary.pkg-els.push $row
    !summary.pkg-items.push [ object { pkg $pkg } { row $row } { dot-btn $dot-btn } { name-btn $name-btn } { active $is-act } ]
   )
  ) }
 ]
)
; to scope.load-catalog (
 -- Loads known lanes index across packages opened by the active session into scope.catalog
 !scope.ensure-session
 ; to loaded !loadSessionCatalog $data $scope.open-package-ids
 ; set $loaded.catalog scope.catalog
 $scope.catalog
)
; to scope.register (
 -- Records a lane in its package index and merges it into scope.catalog
 ; to { id title package-id } $argv
 !scope.ensure-session
 ; to resolved-pkg [ match
  { $package-id : $package-id }
  { true : !getLanePackageId $data $id }
 ]
 ; to entry !registerLaneInPackage $data $id $title $resolved-pkg
 ; to pkg-name !scope.get-package-name $resolved-pkg
 ; set $pkg-name entry.packageName
 ; to scope.catalog $id $entry
 $entry
)
; to scope.list-known (
 -- Returns all known lanes accessible to the active session
 !scope.load-catalog
 !window.Object.values $scope.catalog
)
; to scope.sync-minimized-labels (
 -- Syncs minimized placeholder and rail icon titles after a lane rename or reload
 ; to { lane } $argv
 [ match
  { $lane (
   ; to restore-label ; add 'Restore ' $lane.title
   [ match
    { $lane.minimized-title-el : ; set $lane.title lane.minimized-title-el.textContent }
   ]
   [ match
    { $lane.minimized-placeholder (
     ; set $restore-label lane.minimized-placeholder.title
     !lane.minimized-placeholder.setAttribute aria-label $restore-label
    ) }
   ]
   [ match
    { $lane.minimized-header-btn (
     ; set $restore-label lane.minimized-header-btn.title
     !lane.minimized-header-btn.setAttribute aria-label $restore-label
    ) }
   ]
   !rails.update $lane
  ) }
 ]
)
; to scope.rename (
 -- Updates a lane's title in live state, DOM header, minimized labels, lane KV, and persistent package catalog
 ; to { id title } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; set $title lane.title
   ; set $title lane.title-el.textContent
   [ match
    { $lane.notebook.output-view.sync-title : !lane.notebook.output-view.sync-title }
   ]
   !scope.sync-minimized-labels $lane
   !lane.data.set title $title
   !scope.register $id $title $lane.package-id
   !scope.refresh-import-labels $id
   !scope.refresh-lane-labels $id
   [ match
    { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
   ]
   [ match
    { $rails.sync-minimap : !rails.sync-minimap }
   ]
  ) }
 ]
 $lane
)
; to remove-elem-attr (
 -- Safely removes an attribute across real and mock DOM elements
 ; to { el attr-name } $argv
 [ match
  { $el.removeAttribute : !el.removeAttribute $attr-name }
  { $el.attributes (
   [ match
    { $window.Reflect.deleteProperty : !window.Reflect.deleteProperty $el.attributes $attr-name }
   ]
  ) }
 ]
)
; to strip-lane-backdrop-class (
 -- Removes lane-modal-backdrop--lane from a backdrop class string when mounted globally
 ; to { raw-cls } $argv
 ; to text [ match { $raw-cls : ; add '' $raw-cls } { true : lane-modal-backdrop } ]
 ; to parts !text.split ' '
 ; to kept {}
 ; each $parts (
  ; to { part } $argv
  ; to is-empty [ propertyIs '' part ]
  ; to is-lane-cls [ propertyIs lane-modal-backdrop--lane part ]
  ; condition { propertyIs false is-empty } (
   ; condition { propertyIs false is-lane-cls } : !kept.push $part
  )
 )
 !kept.join ' '
)
; to clear-lane-box-width (
 -- Clears inline width, minHeight, data-modal-open, and --lane-width overrides on a lane header or body cell
 ; to { el } $argv
 !remove-elem-attr $el data-modal-open
 [ match
  { $el.style (
   ; set '' el.style.width
   ; set '' el.style.maxWidth
   ; set '' el.style.minWidth
   ; set '' el.style.minHeight
   [ match
    { $el.style.removeProperty : !el.style.removeProperty '--lane-width' }
    { true : ; set '' el.style.--lane-width }
   ]
  ) }
 ]
)
; to scope.resolve-lane (
 -- Resolves a lane object from a lane reference or lane ID string
 ; to { lane-or-id } $argv
 [ match
  { [ propertyIs null lane-or-id ] : null }
  { [ propertyIs undefined lane-or-id ] : null }
  { [ propertyIs '' lane-or-id ] : null }
  { $lane-or-id.id : $lane-or-id }
  { true : [ get scope.by-id $lane-or-id ] }
 ]
)
; to scope.get-lane-modal-host (
 -- Returns the active DOM container for a lane's modals (fullscreen body when in lane fullscreen, floating preview body when previewed/pinned, otherwise lane.body)
 ; to { lane-or-id } $argv
 ; to lane !scope.resolve-lane $lane-or-id
 [ match
  { $lane (
   ; to in-fullscreen [ match
    { $scope.fullscreen-lane : [ propertyIs $lane.id scope.fullscreen-lane.id ] }
    { true : false }
   ]
   ; to in-preview [ match
    { $rails.preview-lane : [ propertyIs $lane.id rails.preview-lane.id ] }
    { true : false }
   ]
   [ match
    { [ and { [ propertyIs true in-fullscreen ] } { $scope.fullscreen-body } ] : $scope.fullscreen-body }
    { [ and { [ propertyIs true in-preview ] } { $rails.preview-body } ] : $rails.preview-body }
    { $lane.body : $lane.body }
    { $lane.element : $lane.element }
    { true : $document.body }
   ]
  ) }
  { true : $document.body }
 ]
)
; to restore-lane-node (
 -- Re-inserts a child node back into its owning lane container before an optional reference node
 ; to { container node ref } $argv
 [ match
  { $container (
   [ match
    { $node (
     [ match
      { $ref (
       [ match
        { $container.insertBefore : !container.insertBefore $node $ref }
        { true : !container.appendChild $node }
       ]
      ) }
      { true : !container.appendChild $node }
     ]
    ) }
   ]
  ) }
 ]
)
; to scope.insert-lane-body-node (
 -- Inserts a lane body child (notebook or output) into the active fullscreen/rail-preview container if open, or into lane.body before resizer/placeholder
 ; to { lane fallback-container node } $argv
 [ match
  { [ and { $lane } { $scope.fullscreen-lane } { [ propertyIs $lane.id scope.fullscreen-lane.id ] } { $scope.fullscreen-body } ] (
   !scope.fullscreen-body.appendChild $node
  ) }
  { [ and { $lane } { $rails.preview-lane } { [ propertyIs $lane.id rails.preview-lane.id ] } { $rails.preview-body } ] (
   !rails.preview-body.appendChild $node
  ) }
  { true (
   ; to host [ match
    { $lane.body : $lane.body }
    { true : $fallback-container }
   ]
   ; to has-resizer [ match
    { [ and { $lane.body-resizer } { [ propertyIs $host lane.body-resizer.parentNode ] } ] : true }
    { [ and { $lane.body-resizer } { $host.children.includes } ] : !host.children.includes $lane.body-resizer }
    { true : false }
   ]
   ; to has-ph [ match
    { [ and { $lane.minimized-placeholder } { [ propertyIs $host lane.minimized-placeholder.parentNode ] } ] : true }
    { [ and { $lane.minimized-placeholder } { $host.children.includes } ] : !host.children.includes $lane.minimized-placeholder }
    { true : false }
   ]
   ; to ref [ match
    { $has-resizer : $lane.body-resizer }
    { $has-ph : $lane.minimized-placeholder }
    { true : null }
   ]
   !restore-lane-node $host $node $ref
  ) }
 ]
)
; to sync-lane-fullscreen-btn (
 -- Syncs a lane's fullscreen button class, icon SVG, title, and ARIA attributes with lane.is-fullscreen
 ; to { lane } $argv
 [ match
  { $lane.fullscreen-btn (
   ; to active [ propertyIs true lane.is-fullscreen ]
   ; to cls [ ternary $active 'lane-fullscreen-btn lane-fullscreen-btn--active' lane-fullscreen-btn ]
   ; to lbl [ ternary $active 'Exit fullscreen lane' 'Fullscreen lane' ]
   ; to svg [ ternary $active $lane-fs-exit-svg $lane-fs-enter-svg ]
   ; to flag [ ternary $active 'true' 'false' ]
   ; assign $lane.fullscreen-btn { className $cls } { title $lbl } { innerHTML $svg }
   !lane.fullscreen-btn.setAttribute aria-label $lbl
   !lane.fullscreen-btn.setAttribute aria-pressed $flag
   !lane.fullscreen-btn.setAttribute data-fullscreen $flag
  ) }
 ]
)
; to sync-fullscreen-modal-state (
 -- Syncs data-modal-open attribute on the fullscreen lane containers from the active fullscreen lane
 ; to fs-lane $scope.fullscreen-lane
 ; to has-modal [ match
  { [ and { $fs-lane } { [ propertyIs true fs-lane.has-open-modal ] } ] : true }
  { true : false }
 ]
 ; each { $fullscreen-el $fullscreen-frame $fullscreen-header $fullscreen-body } (
  ; to { el } $argv
  [ match
   { $el (
    [ match
     { $has-modal : !el.setAttribute data-modal-open 'true' }
     { true : !remove-elem-attr $el data-modal-open }
    ]
   ) }
  ]
 )
)
; to scope.exit-lane-fullscreen (
 -- Exits lane fullscreen mode, returning live lane DOM nodes back to their owning lane cells
 ; to { skip-repin } $argv
 ; to lane $scope.fullscreen-lane
 [ match
  { $lane (
   ; to restore-pin [ match
    { $skip-repin : false }
    { true : [ propertyIs true scope.fullscreen-was-pinned ] }
   ]
   ; set null scope.fullscreen-lane
   ; set null scope.fullscreen-lane-id
   ; set false scope.is-lane-fullscreen
   ; set false scope.fullscreen-was-pinned
   ; set false lane.is-fullscreen
   !sync-lane-fullscreen-btn $lane
   !restore-lane-node $lane.element $lane.header-top $lane.header-resizer
   [ match
    { $lane.body (
     ; to body-ref [ match
      { $lane.body-resizer : $lane.body-resizer }
      { $lane.minimized-placeholder : $lane.minimized-placeholder }
      { true : null }
     ]
     [ match
      { $lane.notebook.element : !restore-lane-node $lane.body $lane.notebook.element $body-ref }
     ]
     [ match
      { $lane.notebook.output-view.element : !restore-lane-node $lane.body $lane.notebook.output-view.element $body-ref }
     ]
     [ match
      { $lane.open-modals (
       ; each $lane.open-modals (
        ; to { open-m } $argv
        [ match
         { $open-m.backdrop : !restore-lane-node $lane.body $open-m.backdrop $body-ref }
        ]
       )
      ) }
     ]
    ) }
   ]
   !sync-fullscreen-modal-state
   !fullscreen-el.setAttribute data-lane-id ''
   !fullscreen-el.setAttribute aria-hidden 'true'
   ; set true fullscreen-el.hidden
   [ match
    { $lane.notebook.auto-size-rows : !lane.notebook.auto-size-rows }
   ]
   [ match
    { [ and { [ propertyIs true restore-pin ] } { [ propertyIs true lane.is-minimized ] } { $rails.pin } ] : !rails.pin $lane.id }
   ]
   [ match
    { $rails.sync-minimap : !rails.sync-minimap }
   ]
   $lane
  ) }
  { true : null }
 ]
)
; to scope.enter-lane-fullscreen (
 -- Expands a lane to fill the entire screen against a black background covering all rails (without changing browser fullscreen)
 ; to { lane-or-id } $argv
 ; to lane !scope.resolve-lane $lane-or-id
 [ match
  { [ propertyIs null lane ] : null }
  { [ propertyIs true lane.is-locked ] : null }
  { [ and { $scope.fullscreen-lane } { [ propertyIs $lane.id scope.fullscreen-lane.id ] } ] : $lane }
  { true (
   [ match
    { $scope.fullscreen-lane : !scope.exit-lane-fullscreen true }
   ]
   ; to was-pinned [ match
    { $rails.pinned-lane : [ propertyIs $lane.id rails.pinned-lane.id ] }
    { true : false }
   ]
   [ match
    { $rails.close-preferences-menu : !rails.close-preferences-menu }
   ]
   [ match
    { $rails.close-session-menu : !rails.close-session-menu }
   ]
   [ match
    { $rails.close-packages-menu : !rails.close-packages-menu }
   ]
   [ match
    { $rails.close-session-nav : !rails.close-session-nav }
   ]
   [ match
    { $rails.hide-preview : !rails.hide-preview }
   ]
   ; set $lane scope.fullscreen-lane
   ; set $lane.id scope.fullscreen-lane-id
   ; set true scope.is-lane-fullscreen
   ; set $was-pinned scope.fullscreen-was-pinned
   ; set true lane.is-fullscreen
   !sync-lane-fullscreen-btn $lane
   !sync-fullscreen-modal-state
   [ match
    { $lane.header-top : !fullscreen-header.appendChild $lane.header-top }
   ]
   [ match
    { $lane.notebook.element : !fullscreen-body.appendChild $lane.notebook.element }
   ]
   [ match
    { $lane.notebook.output-view.element : !fullscreen-body.appendChild $lane.notebook.output-view.element }
   ]
   [ match
    { $lane.open-modals (
     ; each $lane.open-modals (
      ; to { open-m } $argv
      [ match
       { $open-m.backdrop : !fullscreen-body.appendChild $open-m.backdrop }
      ]
     )
    ) }
   ]
   !fullscreen-el.setAttribute data-lane-id $lane.id
   !fullscreen-el.setAttribute aria-hidden 'false'
   ; set false fullscreen-el.hidden
   [ match
    { $lane.notebook.auto-size-rows : !lane.notebook.auto-size-rows }
   ]
   [ match
    { $rails.sync-minimap : !rails.sync-minimap }
   ]
   $lane
  ) }
 ]
)
; to scope.toggle-lane-fullscreen (
 -- Toggles a lane between full-viewport lane fullscreen mode and normal workspace view
 ; to { lane-or-id } $argv
 ; to lane !scope.resolve-lane $lane-or-id
 [ match
  { [ propertyIs null lane ] : null }
  { [ and { $scope.fullscreen-lane } { [ propertyIs $lane.id scope.fullscreen-lane.id ] } ] (
   !scope.exit-lane-fullscreen
   false
  ) }
  { true (
   !scope.enter-lane-fullscreen $lane
   true
  ) }
 ]
)
; to scope.recompute-lane-modal-bounds (
 -- Recomputes lane.has-open-modal and lane.modal-min-width from lane.open-modals
 ; to { lane } $argv
 [ match
  { $lane (
   ; to modals [ match { $lane.open-modals : $lane.open-modals } { true : {} } ]
   ; to has-open [ propertyIsGreaterThan 0 modals.length ]
   ; set $has-open lane.has-open-modal
   [ match
    { $has-open (
     ; to max-w ; object { val $min-lane-modal-width }
     ; each $modals (
      ; to { m } $argv
      ; to mw [ match
       { [ propertyIsGreaterThan 0 m.active-min-width ] : $m.active-min-width }
       { [ propertyIsGreaterThan 0 m.min-width ] : $m.min-width }
       { true : $min-lane-modal-width }
      ]
      ; condition { propertyIsGreaterThan $max-w.val mw } : ; set $mw max-w.val
     )
     ; set $max-w.val lane.modal-min-width
    ) }
    { true : ; set null lane.modal-min-width }
   ]
  ) }
 ]
)
; to scope.mount-lane-modal (
 -- Mounts a lane-scoped modal backdrop inside the lane's active frame and expands the lane or pinned frame to minimum modal dimensions
 ; to { lane-or-id modal min-width } $argv
 ; to lane !scope.resolve-lane $lane-or-id
 ; to backdrop $modal.backdrop
 [ match
  { $lane (
   [ match
    { $lane.open-modals : null }
    { true : ; set {} lane.open-modals }
   ]
   ; to existing-idx !lane.open-modals.indexOf $modal
   ; condition { propertyIs -1 existing-idx } : !lane.open-modals.push $modal
   ; to req-min-w [ match
    { [ propertyIsGreaterThan 0 min-width ] : $min-width }
    { [ propertyIsGreaterThan 0 modal.min-width ] : $modal.min-width }
    { true : $min-lane-modal-width }
   ]
   ; set $req-min-w modal.active-min-width
   !scope.recompute-lane-modal-bounds $lane
   [ match
    { $backdrop (
     !backdrop.setAttribute data-lane-modal 'true'
     !backdrop.setAttribute data-lane-id $lane.id
     ; to base-cls !strip-lane-backdrop-class $backdrop.className
     ; set [ ; add $base-cls ' lane-modal-backdrop--lane' ] backdrop.className
     ; to host !scope.get-lane-modal-host $lane
     [ match
      { $host.appendChild : !host.appendChild $backdrop }
     ]
    ) }
   ]
   !scope.apply-lane-width $lane $lane.width
  ) }
  { $backdrop (
   !remove-elem-attr $backdrop data-lane-modal
   !remove-elem-attr $backdrop data-lane-id
   ; to clean-cls !strip-lane-backdrop-class $backdrop.className
   ; set $clean-cls backdrop.className
   [ match
    { $document.body.appendChild : !document.body.appendChild $backdrop }
   ]
  ) }
 ]
 $modal
)
; to scope.unmount-lane-modal (
 -- Detaches a lane-scoped modal from its lane and restores the lane or pinned frame's normal dimensions when no modals remain open
 ; to { lane-or-id modal } $argv
 ; to lane !scope.resolve-lane $lane-or-id
 [ match
  { $lane (
   [ match
    { $lane.open-modals (
     ; to idx !lane.open-modals.indexOf $modal
     ; condition { propertyIsGreaterThanOrEqual 0 idx } : !lane.open-modals.splice $idx 1
    ) }
   ]
   !scope.recompute-lane-modal-bounds $lane
   !scope.apply-lane-width $lane $lane.width
  ) }
 ]
 $modal
)
; to scope.close-lane-modals (
 -- Closes all currently open modals belonging to a lane
 ; to { lane } $argv
 [ match
  { $lane.open-modals (
   ; to copy !lane.open-modals.slice 0
   ; each $copy (
    ; to { m } $argv
    [ match
     { $m.close : !m.close true }
    ]
   )
   ; set 0 lane.open-modals.length
   ; set false lane.has-open-modal
   ; set null lane.modal-min-width
  ) }
 ]
 [ match
  { $lane.notebook.output-view.is-floating (
   [ match
    { $lane.notebook.output-view.popin : !lane.notebook.output-view.popin }
   ]
  ) }
 ]
)
; to scope.apply-lane-width (
 -- Applies a lane's stored Width setting to header and body elements (clamping rendered width to >= 100px with no max, and expanding to >= modal-min-width while a lane modal is open)
 ; to { lane raw-width } $argv
 [ match
  { $lane (
   ; to normalized !normalizeLaneWidth $raw-width
   ; to rendered !resolveLaneRenderedWidth $normalized
   ; set $normalized lane.width
   ; set $rendered lane.rendered-width
   ; to has-modal [ propertyIs true lane.has-open-modal ]
   ; to modal-min-w [ match
    { [ and { propertyIs true has-modal } { propertyIsGreaterThan 0 lane.modal-min-width } ] : $lane.modal-min-width }
    { $has-modal : $min-lane-modal-width }
    { true : null }
   ]
   ; to has-width [ match
    { [ propertyIs null rendered ] : false }
    { true : true }
   ]
   ; to effective [ match
    { $has-width (
     [ match
      { $modal-min-w : !window.Math.max $rendered $modal-min-w }
      { true : $rendered }
     ]
    ) }
    { $modal-min-w : $modal-min-w }
    { true : null }
   ]
   ; set $effective lane.effective-width
   ; condition { propertyIs false lane.is-minimized } (
    ; to px-str [ match
     { $has-width : ; add $effective px }
     { true : '' }
    ]
    ; to min-px-str [ match
     { $modal-min-w : ; add $modal-min-w px }
     { $has-width : 100px }
     { true : '' }
    ]
    ; to min-h-str [ match
     { $has-modal : ; add $min-lane-modal-height px }
     { true : '' }
    ]
    [ match
     { $lane.element (
      ; to base-hdr-cls [ ternary $has-width 'lane-header lane-header--sized' lane-header ]
      ; to next-hdr-cls [ ternary [ propertyIs true lane.is-highlighted ] [ ; add $base-hdr-cls ' lane-header--highlighted' ] $base-hdr-cls ]
      ; set $next-hdr-cls lane.element.className
      [ match
       { $has-modal : !lane.element.setAttribute data-modal-open 'true' }
       { true : !remove-elem-attr $lane.element data-modal-open }
      ]
      [ match
       { $lane.element.style (
        ; set $px-str lane.element.style.width
        ; set $px-str lane.element.style.maxWidth
        ; set $min-px-str lane.element.style.minWidth
        [ match
         { $lane.element.style.setProperty (
          [ match
           { $has-width : !lane.element.style.setProperty '--lane-width' $px-str }
           { true (
            [ match
             { $lane.element.style.removeProperty : !lane.element.style.removeProperty '--lane-width' }
            ]
           ) }
          ]
         ) }
         { true : ; set $px-str lane.element.style.--lane-width }
        ]
       ) }
      ]
     ) }
    ]
    [ match
     { $lane.body (
      ; to base-body-cls [ ternary $has-width 'lane-body lane-body--sized' lane-body ]
      ; to next-body-cls [ ternary [ propertyIs true lane.is-highlighted ] [ ; add $base-body-cls ' lane-body--highlighted' ] $base-body-cls ]
      ; set $next-body-cls lane.body.className
      [ match
       { $has-modal : !lane.body.setAttribute data-modal-open 'true' }
       { true : !remove-elem-attr $lane.body data-modal-open }
      ]
      [ match
       { $lane.body.style (
        ; set $px-str lane.body.style.width
        ; set $px-str lane.body.style.maxWidth
        ; set $min-px-str lane.body.style.minWidth
        ; set $min-h-str lane.body.style.minHeight
        [ match
         { $lane.body.style.setProperty (
          [ match
           { $has-width : !lane.body.style.setProperty '--lane-width' $px-str }
           { true (
            [ match
             { $lane.body.style.removeProperty : !lane.body.style.removeProperty '--lane-width' }
            ]
           ) }
          ]
         ) }
         { true : ; set $px-str lane.body.style.--lane-width }
        ]
       ) }
      ]
     ) }
    ]
   )
   [ match
    { $scope.fullscreen-lane (
     ; condition { propertyIs $lane.id scope.fullscreen-lane.id } : !sync-fullscreen-modal-state
    ) }
   ]
   [ match
    { $rails.preview-lane (
     ; condition { propertyIs $lane.id rails.preview-lane.id } : !rails.update $lane
    ) }
   ]
   [ match
    { $rails.sync-minimap : !rails.sync-minimap }
   ]
  ) }
 ]
 $lane
)
; to scope.minimize (
 -- Minimizes an open lane to the left or right side rail and displays a clickable 90-degree vertical title placeholder in its position
 ; to { id raw-side skip-save } $argv
 ; to lane [ get scope.by-id $id ]
 ; to side !normalizeLaneMinimizeSide $raw-side
 [ match
  { $lane (
   [ match
    { $side (
     [ match
      { $scope.fullscreen-lane (
       ; condition { propertyIs $id scope.fullscreen-lane.id } : !scope.exit-lane-fullscreen true
      ) }
     ]
     [ match
      { $rails.preview-lane (
       ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
      ) }
     ]
     [ match
      { $scope.clear-lane-highlight : !scope.clear-lane-highlight $lane }
     ]
     ; set true lane.is-minimized
     ; set $side lane.minimized-side
     ; to restore-label ; add 'Restore ' $lane.title
     ; to header-chevron [ ternary [ propertyIs left side ] '›' '‹' ]
     [ match
      { $lane.element (
       ; set 'lane-header lane-header--minimized' lane.element.className
       !clear-lane-box-width $lane.element
       [ match
        { $lane.element.style : ; assign lane.element.style { textAlign '' } { verticalAlign '' } { padding '' } }
       ]
       [ match
        { $lane.minimized-header-btn (
         ; assign $lane.minimized-header-btn { textContent $header-chevron } { title $restore-label }
         !lane.minimized-header-btn.setAttribute aria-label $restore-label
        ) }
        { true (
         ; to hdr-btn !document.createElement button
         ; assign $hdr-btn { type button } { className lane-minimized-header-btn } { textContent $header-chevron } { title $restore-label }
         !hdr-btn.setAttribute aria-label $restore-label
         !hdr-btn.addEventListener click : !scope.restore $id
         !lane.element.appendChild $hdr-btn
         ; set $hdr-btn lane.minimized-header-btn
        ) }
       ]
      ) }
     ]
     [ match
      { $lane.body (
       ; set 'lane-body lane-body--minimized' lane.body.className
       !clear-lane-box-width $lane.body
      ) }
     ]
     ; to placeholder-host [ match
      { $lane.body : $lane.body }
      { true : $lane.element }
     ]
     [ match
      { $lane.minimized-placeholder (
       !scope.sync-minimized-labels $lane
      ) }
      { true (
       ; to ph-btn !document.createElement button
       ; assign $ph-btn { type button } { className lane-minimized-placeholder } { title $restore-label }
       !ph-btn.setAttribute aria-label $restore-label
       !ph-btn.setAttribute data-lane-id $id
       !ph-btn.setAttribute data-minimized-side $side
       ; to ph-title !document.createElement span
       ; assign $ph-title { className lane-minimized-title } { textContent $lane.title }
       !ph-btn.appendChild $ph-title
       !ph-btn.addEventListener click : !scope.restore $id
       [ match
        { $placeholder-host : !placeholder-host.appendChild $ph-btn }
       ]
       ; set $ph-btn lane.minimized-placeholder
       ; set $ph-title lane.minimized-title-el
      ) }
     ]
     [ match
      { $lane.minimized-placeholder : !lane.minimized-placeholder.setAttribute data-minimized-side $side }
     ]
     !rails.add $lane $side
     [ match
      { $skip-save : null }
      { true : !lane.data.set minimized $side }
     ]
     [ match
      { $rails.sync-minimap : !rails.sync-minimap }
     ]
    ) }
   ]
  ) }
 ]
 $lane
)
; to scope.restore (
 -- Restores a minimized lane back to its original position with its previous width and state
 ; to { id skip-save skip-scroll } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; condition { propertyIs true lane.is-minimized } (
    !rails.remove $id
    ; set false lane.is-minimized
    ; set null lane.minimized-side
    [ match
     { $lane.minimized-header-btn (
      !lane.minimized-header-btn.remove
      ; set null lane.minimized-header-btn
     ) }
    ]
    [ match
     { $lane.minimized-placeholder (
      !lane.minimized-placeholder.remove
      ; set null lane.minimized-placeholder
      ; set null lane.minimized-title-el
     ) }
    ]
    [ match
     { $lane.element.style : ; assign lane.element.style { textAlign left } { verticalAlign top } { padding '0.25em 0.75em' } }
    ]
    !scope.apply-lane-width $lane $lane.width
    [ match
     { $lane.notebook.auto-size-rows : !lane.notebook.auto-size-rows }
    ]
    [ match
     { $skip-save : null }
     { true (
      !lane.data.set minimized ''
      [ match
       { $skip-scroll : null }
       { true : !scope.scroll-lane-into-view $lane }
      ]
     ) }
    ]
    [ match
     { $rails.sync-minimap : !rails.sync-minimap }
    ]
   )
  ) }
 ]
 $lane
)
; to scope.set-width (
 -- Updates a lane's Width setting in live state, DOM, and lane KV storage
 ; to { id raw-width } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   !scope.apply-lane-width $lane $raw-width
   ; to stored [ match
    { [ propertyIs null lane.width ] : '' }
    { true : ; add '' $lane.width }
   ]
   !lane.data.set width $stored
  ) }
 ]
 $lane
)
; to scope.set-resizer-class (
 -- Sets CSS class on both header and body right-edge resize handles of a lane
 ; to { lane cls } $argv
 [ match
  { $lane.header-resizer : ; set $cls lane.header-resizer.className }
 ]
 [ match
  { $lane.body-resizer : ; set $cls lane.body-resizer.className }
 ]
)
; to scope.attach-lane-resizer (
 -- Wires ew-resize drag and double-click reset behavior onto a lane right-boundary resizer handle
 ; to { lane handle-el } $argv
 ; assign $handle-el { className lane-resizer } { title 'Drag to resize lane (double-click to reset)' }
 !handle-el.setAttribute role separator
 !handle-el.setAttribute aria-orientation vertical
 !handle-el.addEventListener mouseenter (
  ; condition { propertyIs false lane.is-resizing } : !scope.set-resizer-class $lane 'lane-resizer lane-resizer--hover'
 )
 !handle-el.addEventListener mouseleave (
  ; condition { propertyIs false lane.is-resizing } : !scope.set-resizer-class $lane lane-resizer
 )
 !handle-el.addEventListener mousedown (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  ; to start-x [ match
   { [ propertyIs undefined ev.clientX ] : 0 }
   { [ propertyIs null ev.clientX ] : 0 }
   { true : $ev.clientX }
  ]
  ; to rect-w [ match
   { $lane.element.getBoundingClientRect (
    ; to rect !lane.element.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] : !window.Math.round $rect.width }
     { true : null }
    ]
   ) }
   { true : null }
  ]
  ; to start-w [ match
   { $rect-w : $rect-w }
   { [ propertyIsGreaterThan 0 lane.element.offsetWidth ] : $lane.element.offsetWidth }
   { [ propertyIsGreaterThan 0 lane.rendered-width ] : $lane.rendered-width }
   { true : 320 }
  ]
  ; to prev-cursor [ match
   { $document.body.style.cursor : $document.body.style.cursor }
   { true : '' }
  ]
  ; set true lane.is-resizing
  !scope.set-resizer-class $lane 'lane-resizer lane-resizer--active'
  [ match
   { $document.body.style : ; set ew-resize document.body.style.cursor }
  ]
  ; to drag ; object { start-x $start-x } { start-w $start-w } { moved false } { next-w $start-w }
  ; to on-move (
   ; to { mev } $argv
   ; to cur-x [ match
    { [ propertyIs undefined mev.clientX ] : $drag.start-x }
    { [ propertyIs null mev.clientX ] : $drag.start-x }
    { true : $mev.clientX }
   ]
   ; to delta ; subtract $cur-x $drag.start-x
   ; to raw-next !window.Math.round ; add $drag.start-w $delta
   ; to clamped !window.Math.max 100 $raw-next
   ; set true drag.moved
   ; set $clamped drag.next-w
   !scope.apply-lane-width $lane $clamped
  )
  ; to on-up (
   ; set false lane.is-resizing
   !scope.set-resizer-class $lane lane-resizer
   [ match
    { $document.body.style : ; set $prev-cursor document.body.style.cursor }
   ]
   [ match
    { $window.removeEventListener (
     !window.removeEventListener mousemove $on-move
     !window.removeEventListener mouseup $on-up
    ) }
   ]
   [ match
    { $drag.moved : !lane.data.set width [ ; add '' $drag.next-w ] }
   ]
  )
  !window.addEventListener mousemove $on-move
  !window.addEventListener mouseup $on-up
 )
 !handle-el.addEventListener dblclick : !scope.set-width $lane.id null
 $handle-el
)
; to scope.get-lane-title (
 -- Returns the display title for a lane ID from open lanes or catalog, falling back to the ID
 ; to { id } $argv
 ; to open-lane [ get scope.by-id $id ]
 ; to cat-entry [ get scope.catalog $id ]
 [ match
  { $open-lane.title : $open-lane.title }
  { $cat-entry.title : $cat-entry.title }
  { true : $id }
 ]
)
; to scope.pick-import (
 -- Opens the Import from Lane picker modal
 ; to { opts } $argv
 !import-modal.open $opts
)
; to scope.pick-table-import (
 -- Opens the Import Table picker modal for mounting a read-only or read-write remote table
 ; to { opts } $argv
 !table-import-modal.open $opts
)
; to scope.pick-export (
 -- Opens the Export to Lane target picker modal
 ; to { opts } $argv
 !export-modal.open $opts
)
; to scope.open-export-deploy (
 -- Opens the Deploy Exported Changes modal for connected Export-to-Lane target lanes
 ; to { opts } $argv
 !export-deploy-modal.open $opts
)
; to scope.pick-lane (
 -- Opens the full-screen lane picker modal for selecting a lane ID
 ; to { opts } $argv
 !lane-modal.open-picker $opts
)
; to scope.cache-line-number (
 -- Caches a 1-based line number for a laneId and lineId pair
 ; to { lane-id line-id num } $argv
 [ match
  { [ and { $lane-id } { $line-id } { [ propertyIsGreaterThan 0 num ] } ] (
   ; to k ; add $lane-id ; add ':' $line-id
   ; to scope.line-num-cache $k $num
  ) }
 ]
 $num
)
; to scope.get-cached-line-number (
 -- Returns a cached 1-based line number for a laneId and lineId pair, or null if not cached
 ; to { lane-id line-id } $argv
 [ match
  { [ and { $lane-id } { $line-id } ] (
   ; to k ; add $lane-id ; add ':' $line-id
   ; to val [ get scope.line-num-cache $k ]
   [ match
    { [ propertyIsGreaterThan 0 val ] : $val }
    { true : null }
   ]
  ) }
  { true : null }
 ]
)
; to scope.resolve-stored-line-number (
 -- Loads a closed accessible lane's script records from KV to populate line-num-cache and invokes on-resolved if found
 ; to { lane-id line-id on-resolved } $argv
 [ match
  { [ and { $lane-id } { $line-id } ] (
   !scope.ensure-session
   ; to access !checkLaneAccess $data $scope.open-package-ids $lane-id
   [ match
    { [ propertyIs true access.allowed ] (
     ; to target-data !data.namespace $lane-id
     ; to loaded !loadLaneScript $data $target-data $lane-id $window
     ; to records [ match { $loaded.records : $loaded.records } { true : {} } ]
     ; to found ; object { num null }
     ; each $records (
      ; to { rec idx } $argv
      ; to num ; add $idx 1
      !scope.cache-line-number $lane-id $rec.id $num
      ; condition { propertyIs $line-id rec.id } : ; set $num found.num
     )
     [ match
      { [ and { $found.num } { $on-resolved } ] : !$on-resolved $found.num }
     ]
     $found.num
    ) }
    { true : null }
   ]
  ) }
  { true : null }
 ]
)
; to scope.refresh-line-numbers (
 -- Updates export target and set-by line number labels across open lanes when a lane's lines are renumbered
 ; to { id } $argv
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.refresh-export-labels : !lane.notebook.refresh-export-labels $id }
  ]
  [ match
   { $lane.notebook.refresh-set-by-labels : !lane.notebook.refresh-set-by-labels $id }
  ]
 )
)
; to scope.refresh-import-labels (
 -- Updates import, export, and set-by button labels across all open lanes after a lane rename
 ; to { id } $argv
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.refresh-import-labels : !lane.notebook.refresh-import-labels $id }
  ]
  [ match
   { $lane.notebook.refresh-export-labels : !lane.notebook.refresh-export-labels $id }
  ]
  [ match
   { $lane.notebook.refresh-set-by-labels : !lane.notebook.refresh-set-by-labels $id }
  ]
 )
)
; to scope.refresh-export-statuses (
 -- Refreshes live deploy status bars across open lanes that target the given lane ID
 ; to { target-id } $argv
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.refresh-export-statuses : !lane.notebook.refresh-export-statuses $target-id }
  ]
 )
)
; to scope.resolve-exporter-line-id (
 -- Resolves the source line ID in caller-lane-id that exports to { target-lane-id target-line-id }
 ; to { caller-lane-id target-lane-id target-line-id caller-line-id } $argv
 ; to clean-caller-line [ match { $caller-line-id : ; add '' $caller-line-id } { true : '' } ]
 [ match
  { [ propertyIs '' clean-caller-line ] (
   ; to open-caller [ get scope.by-id $caller-lane-id ]
   ; to found ; object { id '' }
   [ match
    { $open-caller.notebook.rows (
     ; each $open-caller.notebook.rows (
      ; to { r } $argv
      ; condition { propertyIs '' found.id } (
       ; condition { propertyIs export r.kind } (
        ; to targets [ match { $r.spec.targets : $r.spec.targets } { true : {} } ]
        ; each $targets (
         ; to { t } $argv
         ; condition { and { propertyIs $target-lane-id t.laneId } { propertyIs $target-line-id t.lineId } } : ; set $r.record.id found.id
        )
       )
      )
     )
    ) }
   ]
   $found.id
  ) }
  { true : $clean-caller-line }
 ]
)
; to scope.sync-export-links (
 -- Synchronizes Set-by metadata across open lanes from all mounted export rows
 ; each $scope.lanes (
  ; to { src-lane } $argv
  [ match
   { $src-lane.notebook.rows (
    ; each $src-lane.notebook.rows (
     ; to { src-row } $argv
     ; condition { propertyIs export src-row.kind } (
      ; to targets [ match { $src-row.spec.targets : $src-row.spec.targets } { true : {} } ]
      ; each $targets (
       ; to { t } $argv
       ; to is-other [ ternary [ propertyIs $src-lane.id t.laneId ] false true ]
       ; condition { propertyIs true is-other } (
        ; to open-target [ get scope.by-id $t.laneId ]
        [ match
         { $open-target.notebook.apply-line-set-by (
          !open-target.notebook.apply-line-set-by $t.lineId [ object { laneId $src-lane.id } { lineId $src-row.record.id } ]
         ) }
        ]
       )
      )
     )
    )
   ) }
  ]
 )
)
; to scope.clear-lane-line-set-by (
 -- Clears Set-by metadata on a target lane line when an export target is removed or its export line is deleted
 ; to { target-lane-id target-line-id source-lane-id source-line-id } $argv
 ; to clean-lane [ match { $target-lane-id : ; add '' $target-lane-id } { true : '' } ]
 ; to clean-line [ match { $target-line-id : ; add '' $target-line-id } { true : '' } ]
 ; to clean-src-lane [ match { $source-lane-id : ; add '' $source-lane-id } { true : '' } ]
 ; to clean-src-line [ match { $source-line-id : ; add '' $source-line-id } { true : '' } ]
 [ match
  { [ and { $clean-lane } { $clean-line } ] (
   !scope.ensure-session
   ; to access !checkLaneAccess $data $scope.open-package-ids $clean-lane
   [ match
    { [ propertyIs true access.allowed ] (
     [ match
      { $setTargetLaneLine (
       !setTargetLaneLine $data $clean-lane $clean-line null $window [ object { clear true } { laneId $clean-src-lane } { lineId $clean-src-line } ]
      ) }
     ]
     ; to open-target [ get scope.by-id $clean-lane ]
     [ match
      { $open-target.notebook.clear-line-set-by (
       !open-target.notebook.clear-line-set-by $clean-line $clean-src-lane $clean-src-line
      ) }
     ]
     !scope.sync-export-links
    ) }
   ]
  ) }
 ]
)
; to sync-lane-highlight-classes (
 -- Syncs lane.element and lane.body CSS classes and data-highlighted attributes for normal, sized, locked, minimized, and highlighted states
 ; to { lane } $argv
 [ match
  { $lane (
   ; to is-hl [ match
    { [ propertyIs true lane.is-minimized ] : false }
    { [ propertyIs true lane.is-highlighted ] : true }
    { true : false }
   ]
   ; to has-width [ match
    { [ propertyIs null lane.rendered-width ] : false }
    { [ propertyIs undefined lane.rendered-width ] : false }
    { true : true }
   ]
   [ match
    { $lane.element (
     ; to base-hdr-cls [ match
      { [ propertyIs true lane.is-minimized ] : 'lane-header lane-header--minimized' }
      { [ propertyIs true lane.is-locked ] : 'lane-header lane-header--locked' }
      { $has-width : 'lane-header lane-header--sized' }
      { true : lane-header }
     ]
     ; to next-hdr-cls [ ternary $is-hl [ ; add $base-hdr-cls ' lane-header--highlighted' ] $base-hdr-cls ]
     ; set $next-hdr-cls lane.element.className
     [ match
      { $is-hl : !lane.element.setAttribute data-highlighted 'true' }
      { true : !remove-elem-attr $lane.element data-highlighted }
     ]
    ) }
   ]
   [ match
    { $lane.body (
     ; to base-body-cls [ match
      { [ propertyIs true lane.is-minimized ] : 'lane-body lane-body--minimized' }
      { [ propertyIs true lane.is-locked ] : 'lane-body lane-body--locked' }
      { $has-width : 'lane-body lane-body--sized' }
      { true : lane-body }
     ]
     ; to next-body-cls [ ternary $is-hl [ ; add $base-body-cls ' lane-body--highlighted' ] $base-body-cls ]
     ; set $next-body-cls lane.body.className
     [ match
      { $is-hl : !lane.body.setAttribute data-highlighted 'true' }
      { true : !remove-elem-attr $lane.body data-highlighted }
     ]
    ) }
   ]
  ) }
 ]
)
; to scope.clear-lane-highlight (
 -- Clears any active highlight state and timer on the given lane
 ; to { raw-lane } $argv
 ; to lane !scope.resolve-lane $raw-lane
 [ match
  { $lane (
   [ match
    { $lane.highlight-timer (
     [ match
      { $window.clearTimeout : !window.clearTimeout $lane.highlight-timer }
     ]
     ; set null lane.highlight-timer
    ) }
   ]
   ; condition { propertyIs true lane.is-highlighted } (
    ; set false lane.is-highlighted
    !sync-lane-highlight-classes $lane
    [ match
     { $rails.sync-minimap : !rails.sync-minimap }
    ]
   )
  ) }
 ]
 $lane
)
; to scope.highlight-lane (
 -- Highlights an unminimized lane column with a pulse animation for 2.2s and clears any previous lane highlight
 ; to { raw-lane } $argv
 ; to lane !scope.resolve-lane $raw-lane
 ; each $scope.lanes (
  ; to { other } $argv
  ; condition { propertyIs true other.is-highlighted } : !scope.clear-lane-highlight $other
 )
 [ match
  { $lane (
   !scope.clear-lane-highlight $lane
   ; condition { propertyIs false lane.is-minimized } (
    ; set true lane.is-highlighted
    !sync-lane-highlight-classes $lane
    [ match
     { $rails.sync-minimap : !rails.sync-minimap }
    ]
    [ match
     { $window.setTimeout (
      ; to timer !window.setTimeout (
       ; set null lane.highlight-timer
       ; set false lane.is-highlighted
       !sync-lane-highlight-classes $lane
       [ match
        { $rails.sync-minimap : !rails.sync-minimap }
       ]
      ) 2200
      ; set $timer lane.highlight-timer
     ) }
    ]
   )
  ) }
 ]
 $lane
)
; to scope.locate-lane (
 -- Reveals an open lane: floats and pins its popover if minimized to a side rail, or scrolls to and highlights the lane if in the main area
 ; to { target-lane-id } $argv
 ; to lane !scope.resolve-lane $target-lane-id
 [ match
  { $lane (
   [ match
    { $scope.fullscreen-lane (
     ; to is-same-fs [ propertyIs $lane.id scope.fullscreen-lane.id ]
     ; condition { propertyIs false is-same-fs } : !scope.exit-lane-fullscreen true
    ) }
   ]
   [ match
    { [ propertyIs true lane.is-minimized ] (
     [ match
      { $rails.pin : !rails.pin $lane.id }
     ]
    ) }
    { true (
     [ match
      { $rails.preview-lane : !rails.hide-preview }
     ]
     !scope.highlight-lane $lane
     !scope.scroll-lane-into-view $lane $lane.element
    ) }
   ]
   $lane
  ) }
  { true : null }
 ]
)
; set $scope.locate-lane scope.locate
; to scope.navigate-to-lane-line (
 -- Opens or restores a target lane on the Source tab, highlights the target line, and scrolls the lane and line into view horizontally and vertically
 ; to { target-lane-id target-line-id from-lane-id } $argv
 ; to clean-lane [ match { $target-lane-id : ; add '' $target-lane-id } { true : '' } ]
 ; to clean-line [ match { $target-line-id : ; add '' $target-line-id } { true : '' } ]
 [ match
  { [ propertyIs '' clean-lane ] : null }
  { true (
   [ match
    { $scope.fullscreen-lane (
     ; to is-same-fs [ propertyIs $clean-lane scope.fullscreen-lane.id ]
     ; condition { propertyIs false is-same-fs } : !scope.exit-lane-fullscreen true
    ) }
   ]
   [ match
    { $rails.preview-lane : !rails.hide-preview }
   ]
   ; to existing [ get scope.by-id $clean-lane ]
   ; to target-lane [ match
    { $existing (
     !scope.begin-session-status-pending 'Loading…'
     ; try (
      ; condition { propertyIs true existing.is-minimized } : !scope.restore $clean-lane false true
      [ match
       { $existing.load-task.wait : !existing.load-task.wait }
      ]
      [ match
       { $existing.notebook.set-tab (
        ; to is-source [ propertyIs source existing.notebook.active-tab ]
        ; condition { propertyIs false is-source } : !existing.notebook.set-tab source
       ) }
      ]
     ) : null
     !scope.end-session-status-pending
     $existing
    ) }
    { true (
     !scope.begin-session-status-pending 'Loading…'
     ; to opened null
     ; try (
      ; set [ !scope.open $clean-lane source '' $from-lane-id ] opened
      [ match
       { $opened.is-minimized : !scope.restore $clean-lane false true }
      ]
      !scope.update-url
     ) : null
     !scope.end-session-status-pending
     $opened
    ) }
   ]
   ; to highlighted-row [ match
    { $target-lane.notebook.highlight-line : !target-lane.notebook.highlight-line $clean-line true }
    { true : null }
   ]
   ; to target-el [ match
    { $highlighted-row.el : $highlighted-row.el }
    { true : null }
   ]
   !scope.scroll-lane-into-view $target-lane $target-el
   $target-lane
  ) }
 ]
)
; to scope.navigate-to-lane-table (
 -- Opens or restores a target lane on the Data tab, selects the specified table, highlights the lane, and scrolls it into view
 ; to { target-lane-id target-table-id target-table-name from-lane-id } $argv
 ; to clean-lane [ match { $target-lane-id : ; add '' $target-lane-id } { true : '' } ]
 ; to clean-table-id [ match { $target-table-id : ; add '' $target-table-id } { true : '' } ]
 ; to clean-table-name [ match { $target-table-name : ; add '' $target-table-name } { true : '' } ]
 [ match
  { [ propertyIs '' clean-lane ] : null }
  { true (
   [ match
    { $scope.fullscreen-lane (
     ; to is-same-fs [ propertyIs $clean-lane scope.fullscreen-lane.id ]
     ; condition { propertyIs false is-same-fs } : !scope.exit-lane-fullscreen true
    ) }
   ]
   [ match
    { $rails.preview-lane : !rails.hide-preview }
   ]
   ; to existing [ get scope.by-id $clean-lane ]
   ; to target-lane [ match
    { $existing (
     !scope.begin-session-status-pending 'Loading…'
     ; try (
      ; condition { propertyIs true existing.is-minimized } : !scope.restore $clean-lane false true
      [ match
       { $existing.load-task.wait : !existing.load-task.wait }
      ]
      ; to dv $existing.notebook.data-view
      [ match
       { $dv (
        ; to matched-box ; object { tbl null }
        ; to tid-empty [ propertyIs '' clean-table-id ]
        ; to tname-empty [ propertyIs '' clean-table-name ]
        [ match
         { [ propertyIs false tid-empty ] (
          ; each $dv.tables (
           ; to { t } $argv
           ; condition { propertyIs $clean-table-id t.id } : ; set $t matched-box.tbl
          )
         ) }
        ]
        [ match
         { [ and { $matched-box.tbl } { $dv.select-table } ] : !dv.select-table $matched-box.tbl.id true }
         { [ and { [ propertyIs false tname-empty ] } { $dv.select-table-by-name } ] : !dv.select-table-by-name $clean-table-name true }
        ]
       ) }
      ]
      [ match
       { $existing.notebook.set-tab : !existing.notebook.set-tab data true }
      ]
      [ match
       { $existing.notebook.data-view.sync-data-path : !existing.notebook.data-view.sync-data-path }
       { true : !scope.remember-path $existing }
      ]
      !scope.update-url
     ) : null
     !scope.end-session-status-pending
     $existing
    ) }
    { true (
     !scope.begin-session-status-pending 'Loading…'
     ; to opened null
     ; try (
      ; set [ !scope.open $clean-lane data $clean-table-name $from-lane-id ] opened
      [ match
       { $opened.is-minimized : !scope.restore $clean-lane false true }
      ]
      ; to od-dv $opened.notebook.data-view
      ; to open-tid-empty [ propertyIs '' clean-table-id ]
      [ match
       { [ and { $od-dv } { [ propertyIs false open-tid-empty ] } ] (
        ; to matched-open ; object { tbl null }
        ; each $od-dv.tables (
         ; to { t } $argv
         ; condition { propertyIs $clean-table-id t.id } : ; set $t matched-open.tbl
        )
        ; to already-selected [ propertyIs $matched-open.tbl.id od-dv.active-table-id ]
        [ match
         { [ and { $matched-open.tbl } { [ propertyIs false already-selected ] } { $od-dv.select-table } ] (
          !od-dv.select-table $matched-open.tbl.id true
          !od-dv.sync-data-path
         ) }
        ]
       ) }
      ]
      !scope.update-url
     ) : null
     !scope.end-session-status-pending
     $opened
    ) }
   ]
   [ match
    { $target-lane (
     !scope.highlight-lane $clean-lane
     ; to scroll-target [ match
      { $target-lane.notebook.data-view.table-header-el : $target-lane.notebook.data-view.table-header-el }
      { true : $target-lane.element }
     ]
     !scope.scroll-lane-into-view $target-lane $scroll-target
    ) }
   ]
   $target-lane
  ) }
 ]
)
; to scope.notify-table-dependents (
 -- Propagates live table schema/row updates between an owner lane and all open lanes mounting its tables remotely
 ; to { owner-lane-id owner-tables source-lane-id change-info } $argv
 ; to clean-owner [ match { $owner-lane-id : ; add '' $owner-lane-id } { true : '' } ]
 ; to clean-src [ match { $source-lane-id : ; add '' $source-lane-id } { true : '' } ]
 [ match
  { [ propertyIs '' clean-owner ] : null }
  { true (
   ; to open-owner [ get scope.by-id $clean-owner ]
   ; to eff-tables [ match
    { [ !window.Array.isArray $owner-tables ] : $owner-tables }
    { [ and { [ propertyIs $clean-src clean-owner ] } { $open-owner } { [ !window.Array.isArray $open-owner.notebook.data-view.tables ] } ] : $open-owner.notebook.data-view.tables }
    { true : !loadLaneTables $data [ !data.namespace $clean-owner ] $clean-owner [ object { openPackageIds $scope.open-package-ids } ] }
   ]
   ; each $scope.lanes (
    ; to { dep-lane } $argv
    ; to same-src [ propertyIs $dep-lane.id clean-src ]
    ; to is-locked [ propertyIs true dep-lane.is-locked ]
    ; condition { and { [ propertyIs false same-src ] } { [ propertyIs false is-locked ] } } (
     ; to dep-dv $dep-lane.notebook.data-view
     ; to dep-changed ; object { hit false }
     [ match
      { [ propertyIs $dep-lane.id clean-owner ] (
       [ match
        { $dep-dv.apply-external-owner-table-sync (
         ; to applied !dep-dv.apply-external-owner-table-sync $eff-tables $change-info
         ; condition { propertyIs true applied } : ; set true dep-changed.hit
        ) }
       ]
      ) }
      { $dep-dv.has-remote-from-lane (
       ; to uses-owner !dep-dv.has-remote-from-lane $clean-owner
       ; condition { propertyIs true uses-owner } (
        [ match
         { $dep-dv.sync-remote-tables-from-owner (
          ; to synced !dep-dv.sync-remote-tables-from-owner $clean-owner $eff-tables $change-info
          ; condition { propertyIs true synced } : ; set true dep-changed.hit
         ) }
        ]
       )
      ) }
     ]
     ; condition { propertyIs true dep-changed.hit } (
      ; to dep-tab $dep-lane.notebook.active-tab
      [ match
       { [ propertyIs story dep-tab ] : null }
       { [ propertyIs input dep-tab ] : null }
       { [ propertyIs data dep-tab ] (
        [ match
         { $dep-lane.notebook.run-on-table-change : !dep-lane.notebook.run-on-table-change $change-info }
        ]
       ) }
       { $dep-lane.notebook.run : !dep-lane.notebook.run null false $change-info }
      ]
     )
    )
   )
  ) }
 ]
)
; to scope.set-lane-line (
 -- Writes evaluated text to a target lane line if changed, records Set-by metadata in Civil Command, updates any mounted target lane UI, and returns deploy status
 ; to { target-lane-id target-line-id content caller-lane-id visited caller-line-id } $argv
 ; to clean-lane [ match { $target-lane-id : ; add '' $target-lane-id } { true : '' } ]
 ; to clean-line [ match { $target-line-id : ; add '' $target-line-id } { true : '' } ]
 ; to next-str [ match
  { [ propertyIs null content ] : '' }
  { [ propertyIs undefined content ] : '' }
  { true : ; add '' $content }
 ]
 [ match
  { [ propertyIs '' clean-lane ] : ; object { ok false } { changed false } { laneId '' } { lineId $clean-line } { error 'Target lane ID is required' } }
  { [ propertyIs '' clean-line ] : ; object { ok false } { changed false } { laneId $clean-lane } { lineId '' } { error 'Target line ID is required' } }
  { [ propertyIs $clean-lane caller-lane-id ] : ; object { ok false } { changed false } { laneId $clean-lane } { lineId $clean-line } { error 'Cannot export to the same lane' } }
  { true (
   !scope.ensure-session
   ; to access !checkLaneAccess $data $scope.open-package-ids $clean-lane
   [ match
    { [ propertyIs false access.allowed ] (
     ; to pkg-meta ; try (
      [ match
       { $getPackageMeta : !getPackageMeta $data $access.packageId }
       { true : null }
      ]
     ) : null
     ; to pkg-name [ match { $pkg-meta.name : $pkg-meta.name } { true : $access.packageId } ]
     ; to has-pass [ propertyIs true pkg-meta.hasPassphrase ]
     ; object { ok false } { changed false } { accessDenied true } { requiresPackageUnlock true } { packageId $access.packageId } { packageName $pkg-name } { hasPassphrase $has-pass } { laneId $clean-lane } { lineId $clean-line } { error 'Access denied: lane belongs to a locked package' }
    ) }
    { true (
     ; to resolved-caller-line !scope.resolve-exporter-line-id $caller-lane-id $clean-lane $clean-line $caller-line-id
     ; to set-by-spec [ match
      { $caller-lane-id : [ object { laneId $caller-lane-id } { lineId $resolved-caller-line } ] }
      { true : null }
     ]
     ; to open-target [ get scope.by-id $clean-lane ]
     [ match
      { $open-target.load-task.wait : !open-target.load-task.wait }
     ]
     ; to write-res [ match
      { $setTargetLaneLine : !setTargetLaneLine $data $clean-lane $clean-line $next-str $window $set-by-spec }
      { true : ; object { ok false } { changed false } { error 'setTargetLaneLine helper is not available' } }
     ]
     [ match
      { [ propertyIsGreaterThan 0 write-res.lineNumber ] : !scope.cache-line-number $clean-lane $clean-line $write-res.lineNumber }
     ]
     [ match
      { [ and { propertyIs false write-res.ok } { propertyIs true write-res.syntaxError } { $write-res.draft } { $open-target.notebook.apply-external-rejected-draft } ] (
       !open-target.notebook.apply-external-rejected-draft $clean-line $write-res.draft
      ) }
     ]
     [ match
      { [ and { propertyIs true write-res.ok } { $set-by-spec } { $open-target.notebook.apply-line-set-by } ] (
       !open-target.notebook.apply-line-set-by $clean-line $set-by-spec
      ) }
     ]
     [ match
      { [ and { propertyIs true write-res.ok } { propertyIs true write-res.changed } ] (
       ; to next-visited ; object
       [ match { $visited : ; assign $next-visited $visited } ]
       [ match { $caller-lane-id : ; to next-visited $caller-lane-id true } ]
       ; to already-vis [ get next-visited $clean-lane ]
       [ match
        { $already-vis : null }
        { $open-target.notebook.apply-external-line-update (
         ; to next-visited $clean-lane true
         !open-target.notebook.apply-external-line-update $clean-line $write-res.text $write-res.updatedAt $next-visited $set-by-spec
        ) }
       ]
      ) }
     ]
     ; to lane-title !scope.get-lane-title $clean-lane
     ; to deploy-status ; try (
      [ match
       { $getLaneDeployStatus : !getLaneDeployStatus $data $data $clean-lane }
       { true : null }
      ]
     ) : null
     ; to out ; object
     ; assign $out $write-res [ object
      { laneId $clean-lane }
      { lineId $clean-line }
      { laneTitle $lane-title }
      { deployStatus $deploy-status }
     ]
     $out
    ) }
   ]
  ) }
 ]
)
; to scope.export-lane-line (
 -- Updates one or more { laneId lineId } targets with evaluated content (atomically staging if any target package is closed or locked) and summarizes per-lane deploy status
 ; to { caller-lane-id first-arg second-arg third-arg visited caller-line-id } $argv
 ; to norm-pair [ match
  { $normalizeExportTargetsAndValue : !normalizeExportTargetsAndValue $first-arg $second-arg $third-arg }
  { true : null }
 ]
 ; to is-list [ match { $first-arg.map : true } { true : false } ]
 ; to norm-targets {}
 ; to content-str ''
 [ match
  { $norm-pair (
   ; set $norm-pair.targets norm-targets
   ; set $norm-pair.text content-str
  ) }
  { true (
   ; to raw-targets [ match
    { $is-list : $first-arg }
    { true : { { $first-arg $second-arg } } }
   ]
   ; to raw-content [ match
    { $is-list : $second-arg }
    { true : $third-arg }
   ]
   ; set [ match
    { [ propertyIs null raw-content ] : '' }
    { [ propertyIs undefined raw-content ] : '' }
    { true : ; add '' $raw-content }
   ] content-str
   ; each $raw-targets (
    ; to { entry } $argv
    ; to lid [ match { $entry.laneId : $entry.laneId } { $entry.0 : $entry.0 } { true : '' } ]
    ; to lnid [ match { $entry.lineId : $entry.lineId } { $entry.1 : $entry.1 } { true : '' } ]
    [ match
     { $lid (
      [ match
       { $lnid : !norm-targets.push [ object { laneId $lid } { lineId $lnid } ] }
      ]
     ) }
    ]
   )
  ) }
 ]
 !scope.ensure-session
 ; to access-check [ match
  { [ propertyIs 0 norm-targets.length ] : ; object { allowed true } { requiresPackageUnlock false } { lockedPackages {} } { deniedByLaneId [ object ] } }
  { $checkExportTargetsAccess : !checkExportTargetsAccess $data $scope.open-package-ids $norm-targets $caller-lane-id }
  { true (
   ; to locked-pkgs {}
   ; to denied-map ; object
   ; to seen-pkgs ; object
   ; each $norm-targets (
    ; to { nt } $argv
    ; to is-self [ propertyIs $nt.laneId caller-lane-id ]
    ; condition { and { $nt.laneId } { [ propertyIs false is-self ] } } (
     ; to acc !checkLaneAccess $data $scope.open-package-ids $nt.laneId
     ; condition { propertyIs false acc.allowed } (
      ; to pm ; try ( [ match { $getPackageMeta : !getPackageMeta $data $acc.packageId } { true : null } ] ) : null
      ; to pname [ match { $pm.name : $pm.name } { true : $acc.packageId } ]
      ; to ppass [ propertyIs true pm.hasPassphrase ]
      ; to denied-map $nt.laneId [ object { packageId $acc.packageId } { packageName $pname } { hasPassphrase $ppass } ]
      ; to grp [ get seen-pkgs $acc.packageId ]
      [ match
       { $grp (
        ; to has-lid !grp.laneIds.includes $nt.laneId
        ; condition { propertyIs false has-lid } : !grp.laneIds.push $nt.laneId
        !grp.targets.push [ object { laneId $nt.laneId } { lineId $nt.lineId } ]
       ) }
       { true (
        ; to fresh [ object { packageId $acc.packageId } { packageName $pname } { hasPassphrase $ppass } { laneIds { $nt.laneId } } { targets { [ object { laneId $nt.laneId } { lineId $nt.lineId } ] } } ]
        ; to seen-pkgs $acc.packageId $fresh
        !locked-pkgs.push $fresh
       ) }
      ]
     )
    )
   )
   ; object { allowed [ propertyIs 0 locked-pkgs.length ] } { requiresPackageUnlock [ propertyIsGreaterThan 0 locked-pkgs.length ] } { lockedPackages $locked-pkgs } { deniedByLaneId $denied-map }
  ) }
 ]
 [ match
  { [ propertyIs true access-check.requiresPackageUnlock ] (
   ; to pkg-labels {}
   ; each $access-check.lockedPackages (
    ; to { lp } $argv
    ; to lbl [ match
     { [ and { $lp.packageName } { [ propertyIs false [ propertyIs $lp.packageName lp.packageId ] ] } ] : ; add '"' ; add $lp.packageName ; add '" (' ; add $lp.packageId ')' }
     { true : ; add '"' ; add $lp.packageId '"' }
    ]
    !pkg-labels.push $lbl
   )
   ; to pkg-summary !pkg-labels.join ', '
   ; to block-err ; add 'Access denied: target package(s) must be opened/unlocked for writing before applying exports (' ; add $pkg-summary ')'
   ; to staged-results {}
   ; to lane-statuses {}
   ; to seen-lanes ; object
   ; each $norm-targets (
    ; to { nt } $argv
    ; to denied [ get access-check.deniedByLaneId $nt.laneId ]
    [ match
     { $denied (
      !staged-results.push [ object
       { ok false }
       { changed false }
       { staged true }
       { accessDenied true }
       { requiresPackageUnlock true }
       { packageId $denied.packageId }
       { packageName $denied.packageName }
       { hasPassphrase [ propertyIs true denied.hasPassphrase ] }
       { laneId $nt.laneId }
       { lineId $nt.lineId }
       { text $content-str }
       { error [ ; add 'Access denied: lane belongs to unopened/locked package "' ; add $denied.packageName '"' ] }
      ]
     ) }
     { true (
      !staged-results.push [ object
       { ok false }
       { changed false }
       { staged true }
       { blockedByLockedPackage true }
       { requiresPackageUnlock true }
       { laneId $nt.laneId }
       { lineId $nt.lineId }
       { text $content-str }
       { error $block-err }
      ]
     ) }
    ]
    ; to already-lane [ get seen-lanes $nt.laneId ]
    [ match
     { $already-lane : null }
     { true (
      ; to seen-lanes $nt.laneId true
      ; to raw-title !scope.get-lane-title $nt.laneId
      ; to l-title [ match
       { [ and { $denied } { [ propertyIs 'Locked Lane' raw-title ] } ] : $nt.laneId }
       { true : $raw-title }
      ]
      [ match
       { $denied (
        !lane-statuses.push [ object
         { laneId $nt.laneId }
         { laneTitle $l-title }
         { deployed false }
         { hasChanges false }
         { status 'package-locked' }
         { packageId $denied.packageId }
         { packageName $denied.packageName }
         { hasPassphrase [ propertyIs true denied.hasPassphrase ] }
         { deployStatus null }
        ]
       ) }
       { true (
        !lane-statuses.push [ object
         { laneId $nt.laneId }
         { laneTitle $l-title }
         { deployed false }
         { hasChanges false }
         { status 'staged-pending-unlock' }
         { deployStatus null }
        ]
       ) }
      ]
     ) }
    ]
   )
   [ object
    { ok false }
    { staged true }
    { accessDenied true }
    { requiresPackageUnlock true }
    { lockedPackages $access-check.lockedPackages }
    { content $content-str }
    { targets $staged-results }
    { laneStatuses $lane-statuses }
    { changedCount 0 }
    { needsDeployCount 0 }
    { error $block-err }
   ]
  ) }
  { true (
   ; to results {}
   ; to lane-statuses {}
   ; to seen-lanes ; object
   ; to changed-count ; object { n 0 }
   ; to needs-deploy-count ; object { n 0 }
   ; to all-ok ; object { val true }
   ; each $norm-targets (
    ; to { t } $argv
    ; to res !scope.set-lane-line $t.laneId $t.lineId $content-str $caller-lane-id $visited $caller-line-id
    !results.push $res
    ; condition { propertyIs false res.ok } : ; set false all-ok.val
    ; condition { propertyIs true res.changed } : ; set [ ; add $changed-count.n 1 ] changed-count.n
    ; to already-lane [ get seen-lanes $res.laneId ]
    [ match
     { $already-lane : null }
     { true (
      ; to seen-lanes $res.laneId true
      ; to ds $res.deployStatus
      ; to has-changes [ match { $ds.hasChanges : true } { true : false } ]
      ; condition { propertyIs true has-changes } : ; set [ ; add $needs-deploy-count.n 1 ] needs-deploy-count.n
      !lane-statuses.push [ object
       { laneId $res.laneId }
       { laneTitle $res.laneTitle }
       { deployed [ match { $ds.deployed : true } { true : false } ] }
       { hasChanges $has-changes }
       { status [ match { $ds.status : $ds.status } { true : 'not-deployed' } ] }
       { deployStatus $ds }
      ]
     ) }
    ]
   )
   [ object
    { ok $all-ok.val }
    { requiresPackageUnlock false }
    { lockedPackages {} }
    { content $content-str }
    { targets $results }
    { laneStatuses $lane-statuses }
    { changedCount $changed-count.n }
    { needsDeployCount $needs-deploy-count.n }
   ]
  ) }
 ]
)
; to scope.prompt-unlock-packages-for-export (
 -- Sequentially prompts user to open/unlock any closed or passphrase-locked exported-to packages, then applies staged exports
 ; to { opts } $argv
 !scope.ensure-session
 ; to raw-pkgs [ match { $opts.locked-packages : $opts.locked-packages } { $opts.lockedPackages : $opts.lockedPackages } { true : {} } ]
 ; to queue {}
 ; to seen-q ; object
 ; each $raw-pkgs (
  ; to { pkg } $argv
  ; to pid [ match { $pkg.packageId : $pkg.packageId } { $pkg.id : $pkg.id } { true : '' } ]
  [ match
   { $pid (
    ; to already-seen [ get seen-q $pid ]
    ; to is-open-now [ !scope.open-package-ids.includes $pid ]
    ; condition { and { [ propertyIs undefined already-seen ] } { [ propertyIs false is-open-now ] } } (
     ; to seen-q $pid true
     !queue.push [ object
      { packageId $pid }
      { packageName [ match { $pkg.packageName : $pkg.packageName } { $pkg.name : $pkg.name } { true : $pid } ] }
      { hasPassphrase [ propertyIs true pkg.hasPassphrase ] }
     ]
    )
   ) }
  ]
 )
 ; to src-id [ match { $opts.source-lane-id : $opts.source-lane-id } { $opts.sourceLaneId : $opts.sourceLaneId } { true : '' } ]
 ; to src-title [ match
  { $opts.source-lane-title : $opts.source-lane-title }
  { $opts.sourceLaneTitle : $opts.sourceLaneTitle }
  { [ and { $src-id } { $scope.get-lane-title } ] : !scope.get-lane-title $src-id }
  { true : '' }
 ]
 ; to pending-exps [ match { $opts.pending-exports : $opts.pending-exports } { $opts.pendingExports : $opts.pendingExports } { true : null } ]
 ; to finish-unlocked (
  ; to { opened-ids } $argv
  ; set false scope.unlocking-export-packages
  !scope.refresh-lane-labels
  [ match
   { $pending-exps (
    ; each $pending-exps (
     ; to { pe } $argv
     [ match
      { [ and { $pe.sourceLaneId } { $pe.targets } ] (
       !scope.export-lane-line $pe.sourceLaneId $pe.targets $pe.content null null $pe.lineId
      ) }
     ]
    )
   ) }
  ]
  [ match
   { $opts.on-unlocked : !$opts.on-unlocked $opened-ids }
   { $src-id (
    ; to open-src [ get scope.by-id $src-id ]
    [ match
     { [ and { $open-src.notebook.run } { [ propertyIs false open-src.is-locked ] } ] : !open-src.notebook.run null false null [ object { trigger export-unlock } ] }
    ]
   ) }
  ]
  !scope.refresh-export-statuses
 )
 [ match
  { [ propertyIs 0 queue.length ] (
   !finish-unlocked {}
   ; object { ok true } { openedCount 0 }
  ) }
  { true (
   ; set true scope.unlocking-export-packages
   ; to total $queue.length
   ; to opened-ids {}
   ; to run-step-box ; object { fn null }
   ; to run-step (
    ; to { idx } $argv
    [ match
     { [ propertyIsGreaterThanOrEqual $total idx ] : !finish-unlocked $opened-ids }
     { true (
      ; to pkg [ get queue $idx ]
      ; to is-open-now [ !scope.open-package-ids.includes $pkg.packageId ]
      [ match
       { $is-open-now : !$run-step-box.fn [ ; add $idx 1 ] }
       { true (
        ; to step-num ; add $idx 1
        ; to exp-ctx [ object
         { packageId $pkg.packageId }
         { packageName $pkg.packageName }
         { hasPassphrase $pkg.hasPassphrase }
         { stepIndex $step-num }
         { stepTotal $total }
         { sourceLaneId $src-id }
         { sourceLaneTitle $src-title }
        ]
        !package-modal.open-unlock-package [ object
         { package-id $pkg.packageId }
         { set-active false }
         { export-context $exp-ctx }
         { on-opened (
          !opened-ids.push $pkg.packageId
          ; to next-idx ; add $idx 1
          !$run-step-box.fn $next-idx
         ) }
         { on-cancelled (
          ; set false scope.unlocking-export-packages
          !scope.refresh-lane-labels
          !scope.refresh-export-statuses
          [ match
           { $opts.on-cancel : !$opts.on-cancel $opened-ids }
          ]
         ) }
        ]
       ) }
      ]
     ) }
    ]
   )
   ; set $run-step run-step-box.fn
   !$run-step 0
   ; object { ok true } { promptedCount $total }
  ) }
 ]
)
; to scope.sync-lane-table (
 -- Syncs an array of row objects into a target lane's Data table after verifying package access control
 ; to { caller-lane-id target-lane-id tbl-query records key-col } $argv
 ; to clean-target [ match { $target-lane-id : ; add '' $target-lane-id } { true : '' } ]
 ; to clean-tbl [ match { $tbl-query : ; add '' $tbl-query } { true : '' } ]
 [ match
  { [ propertyIs '' clean-target ] : ; object { ok false } { changed false } { count 0 } { error 'Target lane ID is required' } }
  { [ propertyIs '' clean-tbl ] : ; object { ok false } { changed false } { count 0 } { error 'Target table name or ID is required' } }
  { true (
   !scope.ensure-session
   ; to access !checkLaneAccess $data $scope.open-package-ids $clean-target
   [ match
    { [ propertyIs false access.allowed ] : ; object { ok false } { changed false } { laneId $clean-target } { count 0 } { error 'Access denied: lane belongs to a locked package' } }
    { true (
     ; to target-data !data.namespace $clean-target
     ; to open-target [ get scope.by-id $clean-target ]
     [ match
      { [ and { $open-target.load-task.wait } { [ propertyIs false [ propertyIs $clean-target caller-lane-id ] ] } ] : !open-target.load-task.wait }
     ]
     ; to tables [ match
      { $open-target.notebook.data-view.tables : $open-target.notebook.data-view.tables }
      { true : !loadLaneTables $data $target-data $clean-target [ object { openPackageIds $scope.open-package-ids } ] }
     ]
     ; to res [ match
      { $syncTableRowsInMemory : !syncTableRowsInMemory $tables $clean-tbl $records $key-col }
      { true : ; object { ok false } { changed false } { count 0 } { added 0 } { updated 0 } { removed 0 } { error 'syncTableRowsInMemory is not available' } }
     ]
     [ match
      { $res.ok (
       !saveTableSchemaAndRows $data $target-data $clean-target $res.table
       [ match
        { $open-target.notebook.data-view (
         ; set $tables open-target.notebook.data-view.tables
         [ match
          { $open-target.notebook.data-view.render-grid : !open-target.notebook.data-view.render-grid }
         ]
         [ match
          { $open-target.notebook.data-view.update-table-tabs-text : !open-target.notebook.data-view.update-table-tabs-text }
         ]
        ) }
       ]
       ; to effective-owner [ match
        { $res.table.remote.laneId : $res.table.remote.laneId }
        { true : $clean-target }
       ]
       ; to owner-tables-for-sync [ match
        { [ propertyIs $effective-owner clean-target ] : $tables }
        { true : null }
       ]
       !scope.notify-table-dependents $effective-owner $owner-tables-for-sync $clean-target [ object { tableId $res.table.id } { tableName $res.table.name } { action sync-lane-table } ]
      ) }
     ]
     ; to out ; object
     ; assign $out $res [ object { laneId $clean-target } ]
     $out
    ) }
   ]
  ) }
 ]
)
; to scope.deploy-lane (
 -- Resyncs and deploys a target lane after verifying package access control, updating the triggering table's Updates section in real time
 ; to { caller-lane-id target-lane-id raw-opts table-change } $argv
 ; to clean-target [ match { $target-lane-id : ; add '' $target-lane-id } { true : '' } ]
 [ match
  { [ propertyIs '' clean-target ] : ; object { ok false } { status error } { error 'Target lane ID is required' } }
  { true (
   !scope.ensure-session
   ; to access !checkLaneAccess $data $scope.open-package-ids $clean-target
   [ match
    { [ propertyIs false access.allowed ] : ; object { ok false } { status error } { laneId $clean-target } { error 'Access denied: lane belongs to a locked package' } }
    { true (
     ; to opts [ match
      { [ and { $raw-opts } { $raw-opts.table } ] : $raw-opts }
      { [ and { $raw-opts } { $raw-opts.tableId } ] : $raw-opts }
      { [ and { $raw-opts } { $raw-opts.tableName } ] : $raw-opts }
      { [ and { $raw-opts } { $raw-opts.summary } ] : $raw-opts }
      { [ and { $raw-opts } { [ propertyIs false [ propertyIs undefined raw-opts.recordCount ] ] } ] : $raw-opts }
      { [ and { $raw-opts } { [ propertyIs false [ propertyIs undefined raw-opts.changed ] ] } ] : $raw-opts }
      { [ and { $raw-opts } { [ propertyIs false [ propertyIs undefined raw-opts.force ] ] } ] : $raw-opts }
      { true : ; object }
     ]
     ; to caller-lane [ get scope.by-id $caller-lane-id ]
     ; to caller-dv $caller-lane.notebook.data-view
     ; to caller-tables [ match
      { $caller-dv.tables : $caller-dv.tables }
      { $caller-lane-id : !loadLaneTables $data [ !data.namespace $caller-lane-id ] $caller-lane-id [ object { openPackageIds $scope.open-package-ids } ] }
      { true : {} }
     ]
     ; to tbl-query [ match
      { $opts.tableId : ; add '' $opts.tableId }
      { $opts.table : ; add '' $opts.table }
      { $opts.tableName : ; add '' $opts.tableName }
      { $table-change.tableId : ; add '' $table-change.tableId }
      { $table-change.tableName : ; add '' $table-change.tableName }
      { $caller-dv.active-table-id : ; add '' $caller-dv.active-table-id }
      { true : '' }
     ]
     ; to found-tbl ; object { tbl null }
     ; each $caller-tables (
      ; to { ct } $argv
      ; condition { propertyIs null found-tbl.tbl } (
       [ match
        { [ propertyIs $tbl-query ct.id ] : ; set $ct found-tbl.tbl }
        { [ propertyIs $tbl-query ct.name ] : ; set $ct found-tbl.tbl }
       ]
      )
     )
     ; to src-tbl [ match
      { $found-tbl.tbl : $found-tbl.tbl }
      { [ propertyIsGreaterThan 0 caller-tables.length ] : [ get caller-tables 0 ] }
      { true : null }
     ]
     ; to has-explicit-tbl [ match
      { $opts.tableId : true }
      { $opts.table : true }
      { $opts.tableName : true }
      { true : false }
     ]
     ; to matches-table-change [ match
      { [ propertyIs null table-change ] : true }
      { [ propertyIs undefined table-change ] : true }
      { [ propertyIs false has-explicit-tbl ] : true }
      { [ propertyIs null src-tbl ] : true }
      { [ propertyIs $src-tbl.id table-change.tableId ] : true }
      { [ propertyIs $src-tbl.name table-change.tableName ] : true }
      { true : false }
     ]
     ; to should-skip-other-table [ match
      { [ propertyIs true matches-table-change ] : false }
      { [ propertyIs true opts.changed ] : false }
      { [ propertyIs true opts.force ] : false }
      { true : true }
     ]
     [ match
      { $should-skip-other-table : ; object { ok true } { skipped true } { status 'up-to-date' } { laneId $clean-target } }
      { true (
       ; to is-idle-check [ match
        { $table-change : false }
        { [ propertyIs true opts.changed ] : false }
        { [ propertyIs true opts.force ] : false }
        { [ propertyIs false opts.changed ] : true }
        { true : false }
       ]
       ; to prior-ds ; try (
        [ match
         { [ and { $is-idle-check } { $getLaneDeployStatus } ] : !getLaneDeployStatus $data $data $clean-target }
         { true : null }
        ]
       ) : null
       ; to already-synced [ match
        { [ and { $is-idle-check } { [ propertyIs true prior-ds.deployed ] } { [ propertyIs false prior-ds.hasChanges ] } ] : true }
        { true : false }
       ]
       [ match
        { $already-synced : ; object { ok true } { skipped true } { status 'up-to-date' } { laneId $clean-target } }
        { true (
         ; to target-title !scope.get-lane-title $clean-target
         ; to dep ; try (
          [ match
           { $loadLaneDeployment : !loadLaneDeployment $data $clean-target }
           { true : null }
          ]
         ) : null
         ; to servers ; try (
          [ match
           { $loadDeployServers : !loadDeployServers $data }
           { true : {} }
          ]
         ) : {}
         ; to found-srv ; object { srv null }
         [ match
          { $dep.serverId (
           ; each $servers (
            ; to { s } $argv
            ; condition { propertyIs $dep.serverId s.id } : ; set $s found-srv.srv
           )
          ) }
         ]
         ; to srv $found-srv.srv
         ; to raw-line-id [ match
          { $generateLineId : !generateLineId $window }
          { true : 'ln-upd' }
         ]
         ; to upd-id [ match
          { $raw-line-id.replace : !raw-line-id.replace 'ln-' 'upd-' }
          { true : $raw-line-id }
         ]
         ; to now-str [ match
          { $window.Date : ; add '' [ !window.Date ] }
          { true : '' }
         ]
         ; to rec-count $opts.recordCount
         ; to has-count [ match
          { [ propertyIs null rec-count ] : false }
          { [ propertyIs undefined rec-count ] : false }
          { true : true }
         ]
         ; to count-phrase [ match
          { $has-count (
           ; to unit [ ternary [ propertyIs 1 rec-count ] 'public item' 'public items' ]
           ; add $rec-count ; add ' ' $unit
          ) }
          { true : 'public items' }
         ]
         ; to srv-phrase [ match
          { $srv.name : ; add ' to ' $srv.name }
          { true : '' }
         ]
         ; to trigger-lbl [ match
          { $table-change.action : $table-change.action }
          { $opts.trigger : $opts.trigger }
          { true : 'Record change' }
         ]
         ; to src-tbl-id [ match { $src-tbl.id : $src-tbl.id } { true : '' } ]
         ; to src-tbl-name [ match { $src-tbl.name : $src-tbl.name } { true : $tbl-query } ]
         ; to pending-upd [ object
          { id $upd-id }
          { tableId $src-tbl-id }
          { tableName $src-tbl-name }
          { targetLaneId $clean-target }
          { targetLaneTitle $target-title }
          { status deploying }
          { ok true }
          { slug [ match { $dep.slug : $dep.slug } { true : '' } ] }
          { serverName [ match { $srv.name : $srv.name } { true : '' } ] }
          { publicUrl [ match { $dep.publicUrl : $dep.publicUrl } { true : '' } ] }
          { recordCount $rec-count }
          { trigger $trigger-lbl }
          { summary [ ; add 'Syncing ' ; add $count-phrase ; add ' & deploying' ; add $srv-phrase '…' ] }
          { triggeredAt $now-str }
          { deployedAt $now-str }
          { error null }
         ]
         [ match
          { [ and { $src-tbl-id } { $caller-dv.upsert-table-update } ] (
           !caller-dv.upsert-table-update $src-tbl-id $pending-upd false
          ) }
         ]
         ; to inc-imports [ ternary $dep.includeImports true false ]
         ; to bundle !scope.collect-lane-bundle $clean-target $inc-imports
         ; to resync-res [ match
          { [ and { $resyncDeployedLane } { $bundle } ] (
           !resyncDeployedLane [ object
            { laneId $clean-target }
            { deployment $dep }
            { server $srv }
            { bundle $bundle }
           ]
          ) }
          { $bundle : ; object { ok true } { deployedAt $now-str } { publicUrl [ match { $dep.publicUrl : $dep.publicUrl } { true : '' } ] } }
          { true : ; object { ok false } { error 'Could not collect lane sync bundle' } }
         ]
         ; to dep-ok [ propertyIs true resync-res.ok ]
         ; to dep-at [ match
          { $resync-res.deployedAt : $resync-res.deployedAt }
          { true : $now-str }
         ]
         ; to pub-url [ match
          { $resync-res.publicUrl : $resync-res.publicUrl }
          { $dep.publicUrl : $dep.publicUrl }
          { true : '' }
         ]
         [ match
          { $dep-ok (
           [ match
            { $saveDeployedLaneScript (
             ; to snap-recs [ match
              { $bundle.lanes.0.records : $bundle.lanes.0.records }
              { true : {} }
             ]
             !saveDeployedLaneScript $data $clean-target $snap-recs $dep-at
            ) }
           ]
           [ match
            { [ and { $dep } { $saveLaneDeployment } ] (
             ; to next-dep ; object
             ; assign $next-dep $dep [ object
              { lastDeployedAt $dep-at }
              { lastSyncedAt $dep-at }
              { lastSyncLaneIds { $clean-target } }
              { publicUrl $pub-url }
             ]
             !saveLaneDeployment $data $next-dep
            ) }
           ]
          ) }
         ]
         ; to final-summary [ match
          { $opts.summary : ; add '' $opts.summary }
          { $dep-ok : ; add 'Synced ' ; add $count-phrase ; add ' & deployed' $srv-phrase }
          { true : ; add 'Deploy failed: ' [ match { $resync-res.error : $resync-res.error } { true : 'Unknown error' } ] }
         ]
         ; to final-upd [ object
          { id $upd-id }
          { tableId $src-tbl-id }
          { tableName $src-tbl-name }
          { targetLaneId $clean-target }
          { targetLaneTitle $target-title }
          { status [ ternary $dep-ok deployed error ] }
          { ok $dep-ok }
          { slug [ match { $dep.slug : $dep.slug } { $resync-res.slug : $resync-res.slug } { true : '' } ] }
          { serverName [ match { $srv.name : $srv.name } { true : '' } ] }
          { publicUrl $pub-url }
          { recordCount $rec-count }
          { trigger $trigger-lbl }
          { summary $final-summary }
          { triggeredAt $now-str }
          { deployedAt $dep-at }
          { error [ match { $dep-ok : null } { $resync-res.error : $resync-res.error } { true : 'Deploy failed' } ] }
         ]
         [ match
          { [ and { $src-tbl-id } { $caller-dv.upsert-table-update } ] (
           !caller-dv.upsert-table-update $src-tbl-id $final-upd true
          ) }
          { [ and { $src-tbl-id } { $recordTableDeploymentUpdate } ] (
           !recordTableDeploymentUpdate $data [ !data.namespace $caller-lane-id ] $caller-lane-id $src-tbl-id $final-upd
          ) }
         ]
         !scope.refresh-export-statuses $clean-target
         !scope.refresh-deploy-servers
         $final-upd
        ) }
       ]
      ) }
     ]
    ) }
   ]
  ) }
 ]
)
; to scope.refresh-lane-labels (
 -- Updates Data table lane cell display labels across all open lanes after a lane rename or reload
 ; to { id } $argv
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.data-view.refresh-lane-labels : !lane.notebook.data-view.refresh-lane-labels $id }
  ]
 )
)
; to scope.evaluate-stored-lane (
 -- Evaluates an unmounted lane's persisted script and inputs to completion and returns its final state
 ; to { target-id eval-opts } $argv
 ; to trigger [ match
  { $eval-opts.trigger : $eval-opts.trigger }
  { true : background }
 ]
 ; to apply-exports [ propertyIs true eval-opts.applyExports ]
 ; to skip-story [ propertyIs false eval-opts.recordStory ]
 ; to target-data !data.namespace $target-id
 ; to loaded-script !loadLaneScript $data $target-data $target-id $window
 ; to lines {}
 ; each $loaded-script.records (
  ; to { rec } $argv
  !lines.push $rec.text
 )
 ; to stored-inputs !target-data.get inputs
 ; to inputs !lane-inputs.parse-stored $stored-inputs
 ; to tables !loadLaneTables $data $target-data $target-id [ object { openPackageIds $scope.open-package-ids } ]
 ; to line-ctx ; object { index null } { lineNumber null } { lineId '' }
 ; to story-rec [ match
  { [ and { [ propertyIs false skip-story ] } { $createStoryRunRecorder } ] : !createStoryRunRecorder [ object { laneId $target-id } { trigger $trigger } ] }
  { true : null }
 ]
 ; to export-lane-fn (
  ; to { first-arg second-arg third-arg } $argv
  ; to exp-res [ match
   { $apply-exports : !scope.export-lane-line $target-id $first-arg $second-arg $third-arg null $line-ctx.lineId }
   { true (
    ; to is-list [ match { $first-arg.map : true } { true : false } ]
    ; to raw-c [ ternary $is-list $second-arg $third-arg ]
    ; to c-str [ match
     { [ propertyIs null raw-c ] : '' }
     { [ propertyIs undefined raw-c ] : '' }
     { true : ; add '' $raw-c }
    ]
    ; object { ok true } { readonly true } { content $c-str } { targets {} } { laneStatuses {} } { changedCount 0 } { needsDeployCount 0 }
   ) }
  ]
  [ match
   { [ and { $trackStoryExportLineCall } { $story-rec } ] (
    !trackStoryExportLineCall [ object
     { recorder $story-rec }
     { lineContext $line-ctx }
     { lines $lines }
     { result $exp-res }
    ]
   ) }
  ]
  $exp-res
 )
 ; to sync-lane-tbl-fn (
  ; to { nested-target tbl-q recs k-col } $argv
  ; to sync-res !scope.sync-lane-table $target-id $nested-target $tbl-q $recs $k-col
  [ match
   { [ and { $trackStoryExportTableCall } { $story-rec } ] (
    ; to tgt-title [ match
     { $scope.get-lane-title : !scope.get-lane-title $nested-target }
     { true : $nested-target }
    ]
    !trackStoryExportTableCall [ object
     { recorder $story-rec }
     { lineContext $line-ctx }
     { targetLaneId $nested-target }
     { laneTitle $tgt-title }
     { tableName $tbl-q }
     { records $recs }
     { result $sync-res }
    ]
   ) }
  ]
  $sync-res
 )
 ; to import-lane-fn (
  ; to { nested-id ...nested-path } $argv
  [ match
   { [ propertyIs '' nested-id ] : undefined }
   { [ propertyIs undefined nested-id ] : undefined }
   { true (
    [ match
     { [ and { $trackStoryImportCall } { $story-rec } ] (
      ; to tgt-title [ match
       { $scope.get-lane-title : !scope.get-lane-title $nested-id }
       { true : $nested-id }
      ]
      !trackStoryImportCall [ object
       { recorder $story-rec }
       { lineContext $line-ctx }
       { lines $lines }
       { targetId $nested-id }
       { path $nested-path }
       { laneTitle $tgt-title }
       { invokeImport ( ; to res !scope.get-lane-final-state $nested-id $target-id , !resolveImportValue $res $nested-path ) }
      ]
     ) }
     { true (
      ; to res !scope.get-lane-final-state $nested-id $target-id
      !resolveImportValue $res $nested-path
     ) }
    ]
   ) }
  ]
 )
 ; to env [ object
  { console $console }
  { data [ match { $attenuateKv : !attenuateKv $target-data } { true : $target-data } ] }
  { Math $window.Math }
  { Number $window.Number }
  { JSON $window.JSON }
  { Date $window.Date }
  { Array $window.Array }
  { fetch ( ; to { u o } $argv, [ match { [ and { $data.isProxyBacked } { $data.externalFetch } ] : !data.externalFetch $u $o } { $window.fetch : !window.fetch $u $o } { true : null } ] ) }
  { respond [ match { $createResponseHelper : !createResponseHelper } { true : null } ] }
  { exportLaneLine $export-lane-fn }
  { setLaneLine $export-lane-fn }
  { syncLaneTable $sync-lane-tbl-fn }
  { deployLane (
   ; to { nested-target d-opts } $argv
   !scope.deploy-lane $target-id $nested-target $d-opts null
  ) }
  { resyncLane (
   ; to { nested-target d-opts } $argv
   !scope.deploy-lane $target-id $nested-target $d-opts null
  ) }
  { syncTable (
   ; to { tbl-query records key-col } $argv
   ; to res [ match
    { $syncTableRowsInMemory : !syncTableRowsInMemory $tables $tbl-query $records $key-col }
    { true : ; object { ok false } { count 0 } { added 0 } { updated 0 } }
   ]
   [ match
    { $res.ok (
     ; to next-scoped !buildTablesScope $tables
     ; assign $env $next-scoped
     !saveTableSchemaAndRows $data $target-data $target-id $res.table
     ; to open-target [ get scope.by-id $target-id ]
     [ match
      { $open-target.notebook.data-view (
       ; set $tables open-target.notebook.data-view.tables
       [ match
        { $open-target.notebook.data-view.render-grid : !open-target.notebook.data-view.render-grid }
       ]
       [ match
        { $open-target.notebook.data-view.update-table-tabs-text : !open-target.notebook.data-view.update-table-tabs-text }
       ]
      ) }
     ]
     ; to effective-owner [ match
      { $res.table.remote.laneId : $res.table.remote.laneId }
      { true : $target-id }
     ]
     ; to owner-tables-for-sync [ match
      { [ propertyIs $effective-owner target-id ] : $tables }
      { true : null }
     ]
     !scope.notify-table-dependents $effective-owner $owner-tables-for-sync $target-id [ object { tableId $res.table.id } { tableName $res.table.name } { action sync-table } ]
    ) }
   ]
   $res
  ) }
  { importLane $import-lane-fn }
 ]
 ; to secret-names {}
 ; to secret-set-names {}
 ; to secret-values {}
 ; each $inputs (
  ; to { entry } $argv
  ; to trimmed !entry.name.trim
  [ match
   { [ propertyIs '' trimmed ] : null }
   { [ propertyIs secret entry.type ] (
    !secret-names.push $trimmed
    ; to val [ match
     { [ propertyIs true entry.secretSet ] : [ match
      { $resolveLaneSecret : !resolveLaneSecret $data $target-data $target-id $entry }
      { true : '' }
     ] }
     { true : '' }
    ]
    ; to env $trimmed $val
    ; condition { propertyIs true entry.secretSet } : !secret-set-names.push $trimmed
    ; condition { propertyIsGreaterThan 0 val.length } : !secret-values.push $val
   ) }
   { true (
    ; to val !defaultValueForType $entry.type
    ; to env $trimmed $val
   ) }
  ]
 )
 ; condition { propertyIsGreaterThan 0 secret-names.length } (
  ; to env.__secretNames $secret-names
  ; to env.__secretSetNames $secret-set-names
  ; to env.__secretValues $secret-values
 )
 ; to scoped-tables !buildTablesScope $tables
 ; assign $env $scoped-tables
 ; to captured-inputs [ match
  { $captureStoryEnvInputs : !captureStoryEnvInputs $inputs $env }
  { true : null }
 ]
 ; to run-opts [ object
  { filename $target-id }
  { initialState $env }
  { lineContext $line-ctx }
  { lineRecords $loaded-script.records }
 ]
 ; to outcome !runLines $lines $run-opts
 [ match
  { [ and { [ propertyIs false skip-story ] } { $recordLaneStoryFromRun } ] (
   ; to story-entry !recordLaneStoryFromRun $data $target-data $target-id $story-rec $captured-inputs $outcome $loaded-script.records [ object { trigger $trigger } ]
   ; to open-target [ get scope.by-id $target-id ]
   [ match
    { $open-target.notebook.story-view.on-new-entry : !open-target.notebook.story-view.on-new-entry $story-entry }
   ]
  ) }
 ]
 ; object { ok true } { state $outcome.state } { error null }
)
; to scope.get-lane-final-state (
 -- Awaits completion of another lane once idle and returns its final scope state, guarding against cycles and package access control
 ; to { target-id requester-id } $argv
 [ match
  { [ propertyIs '' target-id ] : ; object { ok false } { state null } { error 'No target lane selected' } }
  { [ propertyIs undefined target-id ] : ; object { ok false } { state null } { error 'No target lane selected' } }
  { [ propertyIs $target-id requester-id ] : ; object { ok false } { state null } { error 'Cannot import from the same lane' } }
  { [ !hasImportCycle $scope.active-imports $requester-id $target-id ] : ; object { ok false } { state null } { error 'Circular lane import detected' } }
  { true (
   !scope.ensure-session
   ; to access !checkLaneAccess $data $scope.open-package-ids $target-id
   [ match
    { [ propertyIs false access.allowed ] : ; object { ok false } { state null } { error 'Access denied: lane belongs to a locked package' } }
    { true (
     ; to tracked-list null
     [ match
      { $requester-id (
       ; to existing [ get scope.active-imports $requester-id ]
       ; to list [ match
        { $existing : $existing }
        { true (
         ; to fresh {}
         ; to scope.active-imports $requester-id $fresh
         $fresh
        ) }
       ]
       !list.push $target-id
       ; set $list tracked-list
      ) }
     ]
     ; to open-lane [ get scope.by-id $target-id ]
     ; to res [ match
      { $open-lane.notebook (
       !open-lane.notebook.when-idle
       ; to completed !open-lane.notebook.has-run
       [ match
        { $completed : ; object { ok true } { state $open-lane.notebook.state } { error null } }
        { true : !scope.evaluate-stored-lane $target-id }
       ]
      ) }
      { true : !scope.evaluate-stored-lane $target-id }
     ]
     [ match
      { $tracked-list (
       ; to idx !tracked-list.indexOf $target-id
       ; condition { propertyIsGreaterThanOrEqual 0 idx } : !tracked-list.splice $idx 1
      ) }
     ]
     $res
    ) }
   ]
  ) }
 ]
)
; to scope.notify-lane-idle (
 -- Re-runs mounted lanes that import from a lane once that lane finishes running and becomes idle
 ; to { source-id visited } $argv
 ; to seen [ match
  { $visited : $visited }
  { true : ; object }
 ]
 ; to already [ get seen $source-id ]
 [ match
  { $already : null }
  { true (
   ; to seen $source-id true
   [ match
    { $scope.preferences-lane-id (
     ; condition { propertyIs $source-id scope.preferences-lane-id } : !scope.apply-preferences
    ) }
   ]
   !scope.refresh-export-statuses $source-id
   ; each $scope.lanes (
    ; to { lane } $argv
    ; to is-other [ ternary [ propertyIs $source-id lane.id ] false true ]
    ; to not-seen [ ternary [ get seen $lane.id ] false true ]
    ; condition { propertyIs true is-other } (
     ; condition { propertyIs true not-seen } (
      [ match
       { $lane.notebook.imports-from (
        ; to depends !lane.notebook.imports-from $source-id
        ; condition { propertyIs true depends } : !lane.notebook.run $seen
       ) }
      ]
     )
    )
   )
  ) }
 ]
)
; to scope.remember-path (
 -- Persists the lane's current navigated path (tab and optional data table subroute) in lane KV storage
 ; to { lane } $argv
 [ match
  { $lane (
   ; to raw-tab [ match
    { $lane.notebook.active-tab : $lane.notebook.active-tab }
    { true : $lane.tab }
   ]
   ; to cur-tab !normalizeLaneTab $raw-tab
   ; to subroute [ match
    { [ propertyIs data cur-tab ] (
     ; to active-tbl [ match
      { $lane.notebook.data-view.get-active-table : !lane.notebook.data-view.get-active-table }
      { true : null }
     ]
     [ match
      { $active-tbl.name : $active-tbl.name }
      { $lane.subroute : $lane.subroute }
      { true : '' }
     ]
    ) }
    { true : '' }
   ]
   ; to formatted !formatLanePath $cur-tab $subroute
   ; to next-path !normalizeLanePath $formatted
   ; set $next-path lane.path
   ; to stored [ match
    { $next-path : $next-path }
    { true : '' }
   ]
   [ match
    { $lane.data.set : !lane.data.set path $stored }
   ]
   $lane.path
  ) }
  { true : null }
 ]
)
; to scope.set-path (
 -- Updates a lane's remembered path in live state, KV storage, active tab/table view, and URL (or resets to default when null/empty)
 ; to { id raw-path } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   !scope.begin-session-status-pending 'Loading…'
   ; try (
    ; to normalized !normalizeLanePath $raw-path
    ; set $normalized lane.path
    ; to stored [ match
     { $normalized : $normalized }
     { true : '' }
    ]
    [ match
     { $lane.data.set : !lane.data.set path $stored }
    ]
    ; to parsed !parseLanePath $normalized
    ; to next-tab [ match
     { $parsed.tab : $parsed.tab }
     { true : source }
    ]
    ; to next-subroute [ match
     { $parsed.subroute : $parsed.subroute }
     { true : '' }
    ]
    ; set $next-tab lane.tab
    ; set $next-subroute lane.subroute
    [ match
     { [ propertyIs data next-tab ] (
      [ match
       { $lane.notebook.data-view.select-table-by-name : !lane.notebook.data-view.select-table-by-name $next-subroute true }
      ]
     ) }
    ]
    [ match
     { $lane.notebook.set-tab (
      [ match
       { [ propertyIs $next-tab lane.notebook.active-tab ] : null }
       { true : !lane.notebook.set-tab $next-tab true }
      ]
     ) }
    ]
    !scope.update-url
   ) : null
   !scope.end-session-status-pending
  ) }
 ]
 $lane
)
; to scope.configure (
 -- Opens the configuration modal for a mounted unlocked lane
 ; to { id } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { [ propertyIs true lane.is-locked ] : null }
  { $lane : !config-modal.open $lane }
 ]
)
; to scope.set-features (
 -- Updates a lane's feature flags in live state, lane KV storage, notebook UI, and singleton cron scheduler
 ; to { id raw-features } $argv
 ; to lane [ get scope.by-id $id ]
 ; to normalized [ match
  { $normalizeLaneFeatures : !normalizeLaneFeatures $raw-features }
  { $raw-features : $raw-features }
  { true : ; object { httpServer false } { runEvery30Minutes false } }
 ]
 [ match
  { $lane (
   ; set $normalized lane.features
   ; to serialized !window.JSON.stringify $normalized
   [ match
    { $lane.data.set : !lane.data.set features $serialized }
   ]
   [ match
    { $lane.notebook.set-features : !lane.notebook.set-features $normalized }
   ]
  ) }
 ]
 [ match
  { $scope.sync-lane-cron : !scope.sync-lane-cron $id $normalized }
 ]
 $normalized
)
; to scope.refresh-deploy-servers (
 -- Refreshes the target SSH servers dropdown and known deployments across all open lanes with Server tabs
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.server-view.refresh-servers : !lane.notebook.server-view.refresh-servers }
  ]
  [ match
   { $lane.notebook.server-view.refresh-deployments : !lane.notebook.server-view.refresh-deployments }
  ]
 )
)
; to scope.collect-lane-bundle (
 -- Collects a lane (and optionally transitively imported lanes) for syncing to civil-memory KV, overlaying any open lane's live in-memory tables and script records
 ; to { lane-id include-imports } $argv
 ; to open-main [ get scope.by-id $lane-id ]
 [ match
  { $open-main.notebook.data-view.save : !open-main.notebook.data-view.save }
 ]
 ; to bundle [ match
  { $collectLaneSyncBundle : !collectLaneSyncBundle $data $lane-id [ object { includeImports $include-imports } { openPackageIds $scope.open-package-ids } { win $window } ] }
  { true : null }
 ]
 [ match
  { $bundle.lanes (
   ; each $bundle.lanes (
    ; to { item } $argv
    ; to open-item [ get scope.by-id $item.id ]
    [ match
     { $open-item.notebook.data-view.tables : ; set $open-item.notebook.data-view.tables item.tables }
    ]
    [ match
     { [ and { $open-item.notebook.line-records } { [ propertyIsGreaterThan 0 open-item.notebook.line-records.length ] } ] (
      ; to live-recs {}
      ; each $open-item.notebook.line-records (
       ; to { r } $argv
       !live-recs.push [ object
        { id $r.id }
        { text [ match { [ propertyIs null r.text ] : '' } { [ propertyIs undefined r.text ] : '' } { true : ; add '' $r.text } ] }
        { updatedAt [ match { $r.updatedAt : $r.updatedAt } { true : null } ] }
       ]
      )
      ; set $live-recs item.records
     ) }
    ]
   )
  ) }
 ]
 $bundle
)
; to scope.mount-locked (
 -- Mounts a locked access-denied lane placeholder with an unlock/open-package prompt
 ; to { id package-id initial-tab initial-subroute insert-index } $argv
 ; to pkg-id [ match
  { $package-id : $package-id }
  { true : default }
 ]
 ; to tab !normalizeLaneTab $initial-tab
 ; to subroute [ match
  { $initial-subroute : $initial-subroute }
  { true : '' }
 ]
 ; to has-insert-index [ match
  { [ propertyIs null insert-index ] : false }
  { [ propertyIs undefined insert-index ] : false }
  { [ propertyIs '' insert-index ] : false }
  { [ propertyIsGreaterThanOrEqual 0 insert-index ] : [ propertyIsLessThan $scope.lanes.length insert-index ] }
  { true : false }
 ]
 ; to before-lane [ match
  { $has-insert-index : [ get scope.lanes $insert-index ] }
  { true : null }
 ]
 ; to created [ match
  { $before-lane : !scope.create-lane $before-lane }
  { true : !scope.create-lane }
 ]
 ; to element [ match
  { $created.header : $created.header }
  { true : $created }
 ]
 ; to body-el [ match
  { $created.body : $created.body }
  { true : null }
 ]
 !element.setAttribute data-lane-id $id
 !element.setAttribute data-locked 'true'
 ; set 'lane-header lane-header--locked' element.className
 ; assign element.style { textAlign left } { verticalAlign top } { padding '0.25em 0.75em' }
 ; to header-top !document.createElement div
 ; set lane-header-top header-top.className
 ; to meta-el !document.createElement div
 ; set lane-header-meta meta-el.className
 ; to title-el !document.createElement div
 ; set 'Locked Lane' title-el.textContent
 ; to id-el !document.createElement div
 ; set $id id-el.textContent
 ; assign id-el.style { fontFamily '"IBM Plex Mono", monospace' } { fontSize 10px } { fontWeight normal } { opacity '0.65' }
 !meta-el.appendChild $title-el
 !meta-el.appendChild $id-el
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-close-btn } { textContent '×' } { title 'Close lane' }
 !close-btn.addEventListener click : !scope.close $id
 !header-top.appendChild $meta-el
 !header-top.appendChild $close-btn
 !element.appendChild $header-top

 ; to unlock-btn !document.createElement button
 ; assign $unlock-btn { type button } { className lane-locked-unlock-btn } { textContent 'Open Package' }
 !unlock-btn.addEventListener click : !package-modal.open-unlock-package [ object { package-id $pkg-id } ]

 [ match
  { $body-el (
   !body-el.setAttribute data-lane-id $id
   ; set 'lane-body lane-body--locked' body-el.className
   ; to card !document.createElement div
   ; set lane-locked-card card.className
   ; to card-title !document.createElement div
   ; assign $card-title { className lane-locked-title } { textContent 'Locked Lane' }
   ; to card-msg !document.createElement div
   ; to msg-txt ; add 'Access denied. This lane belongs to package "' ; add $pkg-id '", which is not open in this session.'
   ; assign $card-msg { className lane-locked-msg } { textContent $msg-txt }
   !card.appendChild $card-title
   !card.appendChild $card-msg
   !card.appendChild $unlock-btn
   !body-el.appendChild $card
  ) }
 ]

 ; to lane [ object
  { id $id }
  { package-id $pkg-id }
  { is-locked true }
  { tab $tab }
  { subroute $subroute }
  { path '' }
  { title 'Locked Lane' }
  { width null }
  { rendered-width null }
  { effective-width null }
  { open-modals {} }
  { has-open-modal false }
  { modal-min-width null }
  { is-resizing false }
  { is-minimized false }
  { is-highlighted false }
  { highlight-timer null }
  { header-top $header-top }
  { title-el $title-el }
  { element $element }
  { body $body-el }
  { close-btn $close-btn }
  { unlock-btn $unlock-btn }
 ]
 [ match
  { $has-insert-index (
   !scope.lanes.splice $insert-index 0 $lane
   !scope.lane-ids.splice $insert-index 0 $id
  ) }
  { true (
   !scope.lanes.push $lane
   !scope.lane-ids.push $id
  ) }
 ]
 ; each $scope.lanes (
  ; to { item idx } $argv
  ; to num ; add $idx 1
  ; set $num item.number
 )
 ; to scope.by-id $id $lane
 [ match
  { $rails.sync-minimap : !rails.sync-minimap }
 ]
 $lane
)
; to default-lane-features : ; object { httpServer false } { runEvery30Minutes false }
; to scope.mount (
 -- Mounts a lane DOM header, gear config button, minimize buttons, reload button, close button, resize handles, notebook body, and registers it on scope
 ; to { id title lane-data initial-tab initial-subroute initial-width initial-minimized insert-index initial-path package-id initial-features defer-notebook } $argv
 ; to resolved-pkg [ match
  { $package-id : $package-id }
  { true : default }
 ]
 ; to features [ match
  { $normalizeLaneFeatures : !normalizeLaneFeatures $initial-features }
  { $initial-features : $initial-features }
  { true : !default-lane-features }
 ]
 ; to raw-tab !normalizeLaneTab $initial-tab
 ; to tab [ match
  { [ propertyIs server raw-tab ] (
   [ match
    { $features.httpServer : server }
    { true : source }
   ]
  ) }
  { true : $raw-tab }
 ]
 ; to subroute [ match
  { $initial-subroute : $initial-subroute }
  { true : '' }
 ]
 ; to path !normalizeLanePath $initial-path
 ; to norm-min !normalizeLaneMinimizeSide $initial-minimized
 ; to has-insert-index [ match
  { [ propertyIs null insert-index ] : false }
  { [ propertyIs undefined insert-index ] : false }
  { [ propertyIs '' insert-index ] : false }
  { [ propertyIsGreaterThanOrEqual 0 insert-index ] : [ propertyIsLessThan $scope.lanes.length insert-index ] }
  { true : false }
 ]
 ; to before-lane [ match
  { $has-insert-index : [ get scope.lanes $insert-index ] }
  { true : null }
 ]
 ; to created [ match
  { $before-lane : !scope.create-lane $before-lane $norm-min }
  { $norm-min : !scope.create-lane null $norm-min }
  { true : !scope.create-lane }
 ]
 ; to element [ match
  { $created.header : $created.header }
  { true : $created }
 ]
 ; to body-el [ match
  { $created.body : $created.body }
  { true : null }
 ]
 !element.setAttribute data-lane-id $id
 [ match
  { [ propertyIs null norm-min ] : ; assign element.style { textAlign left } { verticalAlign top } { padding '0.25em 0.75em' } }
 ]
 ; to header-top !document.createElement div
 ; set lane-header-top header-top.className
 ; to config-btn !document.createElement button
 ; assign $config-btn { type button } { className 'lane-control-btn lane-config-btn' } { title 'Configure lane' } { innerHTML '<svg class="lane-config-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M6.56 3L6.63 1.24L9.37 1.24L9.44 3A5.2 5.2 0 0 1 11.61 4.26L13.17 3.43L14.54 5.81L13.05 6.75A5.2 5.2 0 0 1 13.05 9.25L14.54 10.19L13.17 12.57L11.61 11.74A5.2 5.2 0 0 1 9.44 13L9.37 14.76L6.63 14.76L6.56 13A5.2 5.2 0 0 1 4.39 11.74L2.83 12.57L1.46 10.19L2.95 9.25A5.2 5.2 0 0 1 2.95 6.75L1.46 5.81L2.83 3.43L4.39 4.26A5.2 5.2 0 0 1 6.56 3ZM8 5.5A2.5 2.5 0 1 0 8 10.5A2.5 2.5 0 1 0 8 5.5Z"></path></svg>' }
 !config-btn.setAttribute aria-label 'Configure lane'
 !config-btn.addEventListener click : !scope.configure $id
 ; to meta-el !document.createElement div
 ; set lane-header-meta meta-el.className
 ; to title-el !document.createElement div
 ; set $title title-el.textContent
 ; to id-el !document.createElement div
 ; set $id id-el.textContent
 ; assign id-el.style { fontFamily '"IBM Plex Mono", monospace' } { fontSize 10px } { fontWeight normal } { opacity '0.65' }
 !meta-el.appendChild $title-el
 !meta-el.appendChild $id-el
 ; to copy-icon-svg '<svg class="lane-copy-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"></rect><path d="M10.5 5.5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5.5"></path></svg>'
 ; to copy-check-svg '<svg class="lane-copy-icon lane-copy-icon--copied" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5L6.5 11.5L12.5 4.5"></path></svg>'
 ; to copy-info-btn !document.createElement button
 ; assign $copy-info-btn { type button } { className lane-copy-btn } { title 'Copy lane info for agent' } { innerHTML $copy-icon-svg }
 !copy-info-btn.setAttribute aria-label 'Copy lane info for agent'
 ; to min-left-btn !document.createElement button
 ; assign $min-left-btn { type button } { className 'lane-min-btn lane-min-btn--left' } { title 'Minimize to left rail' } { innerHTML '<svg class="lane-min-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8L10 12.5"></path></svg>' }
 !min-left-btn.setAttribute aria-label 'Minimize to left rail'
 !min-left-btn.addEventListener click : !scope.minimize $id left
 ; to min-right-btn !document.createElement button
 ; assign $min-right-btn { type button } { className 'lane-min-btn lane-min-btn--right' } { title 'Minimize to right rail' } { innerHTML '<svg class="lane-min-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5L10.5 8L6 12.5"></path></svg>' }
 !min-right-btn.setAttribute aria-label 'Minimize to right rail'
 !min-right-btn.addEventListener click : !scope.minimize $id right
 ; to reload-btn !document.createElement button
 ; assign $reload-btn { type button } { className lane-reload-btn } { textContent '↻' } { title 'Reload lane' }
 !reload-btn.setAttribute aria-label 'Reload lane'
 !reload-btn.addEventListener click : !scope.reload $id
 ; to fullscreen-btn !document.createElement button
 ; assign $fullscreen-btn { type button } { className lane-fullscreen-btn } { textContent '' } { title 'Fullscreen lane' } { innerHTML $lane-fs-enter-svg }
 !fullscreen-btn.setAttribute aria-label 'Fullscreen lane'
 !fullscreen-btn.setAttribute aria-pressed 'false'
 !fullscreen-btn.setAttribute data-fullscreen 'false'
 !fullscreen-btn.addEventListener click : !scope.toggle-lane-fullscreen $id
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-close-btn } { textContent '×' } { title 'Close lane' }
 !close-btn.addEventListener click : !scope.close $id
 !header-top.appendChild $config-btn
 !header-top.appendChild $meta-el
 !header-top.appendChild $copy-info-btn
 !header-top.appendChild $min-left-btn
 !header-top.appendChild $min-right-btn
 !header-top.appendChild $reload-btn
 !header-top.appendChild $fullscreen-btn
 !header-top.appendChild $close-btn
 !element.appendChild $header-top
 ; to header-resizer !document.createElement div
 !element.appendChild $header-resizer
 ; to lane [ object
  { id $id }
  { package-id $resolved-pkg }
  { features $features }
  { is-locked false }
  { tab $tab }
  { subroute $subroute }
  { path $path }
  { title $title }
  { width null }
  { rendered-width null }
  { effective-width null }
  { open-modals {} }
  { has-open-modal false }
  { modal-min-width null }
  { is-resizing false }
  { is-fullscreen false }
  { is-minimized false }
  { is-highlighted false }
  { highlight-timer null }
  { load-task null }
  { reload-seq 0 }
  { minimized-side null }
  { minimized-header-btn null }
  { minimized-placeholder null }
  { minimized-title-el null }
  { header-top $header-top }
  { title-el $title-el }
  { data $lane-data }
  { element $element }
  { body $body-el }
  { header-resizer $header-resizer }
  { body-resizer null }
  { config-btn $config-btn }
  { copy-info-btn $copy-info-btn }
  { copy-agent-btn $copy-info-btn }
  { copy-btn $copy-info-btn }
  { copy-timer null }
  { min-left-btn $min-left-btn }
  { min-right-btn $min-right-btn }
  { reload-btn $reload-btn }
  { fullscreen-btn $fullscreen-btn }
  { close-btn $close-btn }
 ]
 !copy-info-btn.addEventListener click (
  !scope.copy-agent-context $lane
  ; assign $copy-info-btn { className 'lane-copy-btn lane-copy-btn--copied' } { title Copied } { innerHTML $copy-check-svg }
  [ match
   { $window.setTimeout (
    [ match
     { $lane.copy-timer : !window.clearTimeout $lane.copy-timer }
    ]
    ; to next-timer !window.setTimeout (
     ; assign $copy-info-btn { className lane-copy-btn } { title 'Copy lane info for agent' } { innerHTML $copy-icon-svg }
     ; set null lane.copy-timer
    ) 1200
    ; set $next-timer lane.copy-timer
   ) }
  ]
 )
 !scope.attach-lane-resizer $lane $header-resizer
 [ match
  { $has-insert-index (
   !scope.lanes.splice $insert-index 0 $lane
   !scope.lane-ids.splice $insert-index 0 $id
  ) }
  { true (
   !scope.lanes.push $lane
   !scope.lane-ids.push $id
  ) }
 ]
 ; each $scope.lanes (
  ; to { item idx } $argv
  ; to num ; add $idx 1
  ; set $num item.number
 )
 ; to scope.by-id $id $lane
 [ match
  { $body-el (
   !body-el.setAttribute data-lane-id $id
   ; to body-resizer !document.createElement div
   ; set $body-resizer lane.body-resizer
   !scope.attach-lane-resizer $lane $body-resizer
   [ match
    { $norm-min (
     !body-el.appendChild $body-resizer
     !scope.minimize $id $norm-min true
     !scope.apply-lane-width $lane $initial-width
     !lane-notebook.mount $lane $body-el $scope $tab [ ternary $defer-notebook true false ]
    ) }
    { true (
     !scope.apply-lane-width $lane $initial-width
     !lane-notebook.mount $lane $body-el $scope $tab false
     !body-el.appendChild $body-resizer
    ) }
   ]
  ) }
  { true (
   [ match
    { $norm-min : !scope.minimize $id $norm-min true }
   ]
   !scope.apply-lane-width $lane $initial-width
  ) }
 ]
 [ match
  { $rails.sync-minimap : !rails.sync-minimap }
 ]
 $lane
)
; to scope.update-url (
 -- Updates browser URL pathname to reflect current lane IDs and active tabs/tables while preserving search and hash, and recomputes session draft state
 ; to pathname !formatLaneRoutes $scope.lanes
 ; to search [ match
  { $location.search : $location.search }
  { true : '' }
 ]
 ; to hash [ match
  { $location.hash : $location.hash }
  { true : '' }
 ]
 ; to url ; add [ ; add $pathname $search ] $hash
 [ match
  { [ propertyIs $location.pathname pathname ] : null }
  { true : !history.pushState null '' $url }
 ]
 !scope.recompute-session-dirty
)
; to scope.reload (
 -- Reloads an open lane from scratch from persisted KV storage (enforcing package access control) while preserving its position and selected tab
 ; to { id } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   ; to prev-seq [ match
    { [ propertyIs undefined lane.reload-seq ] : 0 }
    { true : $lane.reload-seq }
   ]
   ; to rseq ; add $prev-seq 1
   ; set $rseq lane.reload-seq
   [ match
    { $lane.reload-btn (
     ; set true lane.reload-btn.disabled
     ; set 'lane-reload-btn lane-reload-btn--loading' lane.reload-btn.className
    ) }
   ]
   !scope.ensure-session
   !scope.begin-session-status-pending 'Loading…'
   ; try (
    ; to pre-current [ and { [ propertyIs $lane scope.by-id $id ] } { [ propertyIs $rseq lane.reload-seq ] } ]
    [ match
     { $pre-current (
      ; to access !checkLaneAccess $data $scope.open-package-ids $id
      [ match
       { [ and { [ propertyIs $lane scope.by-id $id ] } { [ propertyIs $rseq lane.reload-seq ] } ] (
        [ match
         { [ propertyIs true lane.is-locked ] (
          ; condition { propertyIs true access.allowed } : !scope.sync
         ) }
         { [ propertyIs false access.allowed ] : !scope.sync }
         { true (
          ; to raw-tab [ match
           { $lane.notebook.active-tab : $lane.notebook.active-tab }
           { true : $lane.tab }
          ]
          ; to current-tab !normalizeLaneTab $raw-tab
          ; to stored-title !lane.data.get title
          ; to stored-width !lane.data.get width
          ; to stored-minimized !lane.data.get minimized
          ; to stored-path-raw !lane.data.get path
          ; to stored-path !normalizeLanePath $stored-path-raw
          ; to stored-features-raw !lane.data.get features
          ; to next-features [ match
           { $parseLaneFeatures : !parseLaneFeatures $stored-features-raw }
           { true : ; object { httpServer false } { runEvery30Minutes false } }
          ]
          ; to still-current [ and { [ propertyIs $lane scope.by-id $id ] } { [ propertyIs $rseq lane.reload-seq ] } ]
          [ match
           { $still-current (
            ; to was-fullscreen [ match
             { $scope.fullscreen-lane : [ propertyIs $id scope.fullscreen-lane.id ] }
             { true : false }
            ]
            ; to was-fs-pinned [ match
             { $was-fullscreen : [ propertyIs true scope.fullscreen-was-pinned ] }
             { true : false }
            ]
            [ match
             { $was-fullscreen : !scope.exit-lane-fullscreen true }
            ]
            ; to was-pinned [ match
             { $rails.pinned-lane : [ propertyIs $id rails.pinned-lane.id ] }
             { true : false }
            ]
            [ match
             { $rails.preview-lane (
              ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
             ) }
            ]
            ; set $access.packageId lane.package-id
            ; to was-minimized $lane.is-minimized
            ; set $stored-path lane.path
            ; set $next-features lane.features
            [ match
             { $scope.sync-lane-cron : !scope.sync-lane-cron $id $next-features }
            ]
            ; to resolved-tab [ match
             { [ propertyIs server current-tab ] (
              [ match
               { $next-features.httpServer : server }
               { true : source }
              ]
             ) }
             { true : $current-tab }
            ]
            ; set $resolved-tab lane.tab
            ; to next-min !normalizeLaneMinimizeSide $stored-minimized
            [ match
             { $stored-title (
              ; set $stored-title lane.title
              ; set $stored-title lane.title-el.textContent
              !scope.sync-minimized-labels $lane
              !scope.register $id $stored-title $access.packageId
              !scope.refresh-import-labels $id
              !scope.refresh-lane-labels $id
              [ match
               { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
              ]
             ) }
            ]
            ; to old-nb-el $lane.notebook.element
            ; to old-out-el $lane.notebook.output-view.element
            [ match
             { $lane.notebook.dispose : !lane.notebook.dispose }
            ]
            ; set null lane.load-task
            [ match
             { $next-min (
              !scope.minimize $id $next-min true
              !scope.apply-lane-width $lane $stored-width
             ) }
             { $was-minimized (
              !scope.restore $id true
              !scope.apply-lane-width $lane $stored-width
             ) }
             { true : !scope.apply-lane-width $lane $stored-width }
            ]
            [ match
             { $lane.body (
              [ match
               { $next-min (
                [ match
                 { $lane.body.replaceChildren (
                  [ match
                   { [ and { $lane.body-resizer } { $lane.minimized-placeholder } ] : !lane.body.replaceChildren $lane.body-resizer $lane.minimized-placeholder }
                   { $lane.minimized-placeholder : !lane.body.replaceChildren $lane.minimized-placeholder }
                   { $lane.body-resizer : !lane.body.replaceChildren $lane.body-resizer }
                   { true : !lane.body.replaceChildren }
                  ]
                 ) }
                 { true (
                  [ match { $old-nb-el.remove : !old-nb-el.remove } ]
                  [ match { $old-out-el.remove : !old-out-el.remove } ]
                 ) }
                ]
                !lane-notebook.mount $lane $lane.body $scope $resolved-tab false
               ) }
               { true (
                [ match
                 { $lane.body.replaceChildren : !lane.body.replaceChildren }
                 { true (
                  ; while { propertyIsGreaterThan 0 lane.body.children.length } (
                   ; to child !lane.body.children.pop
                   [ match
                    { $child.remove : !child.remove }
                   ]
                  )
                 ) }
                ]
                !lane-notebook.mount $lane $lane.body $scope $resolved-tab false
                [ match
                 { $lane.body-resizer : !lane.body.appendChild $lane.body-resizer }
                ]
               ) }
              ]
              [ match
               { [ propertyIs story resolved-tab ] : !scope.notify-lane-idle $id }
               { [ propertyIs input resolved-tab ] : !scope.notify-lane-idle $id }
               { [ propertyIs data resolved-tab ] : !scope.notify-lane-idle $id }
              ]
             ) }
            ]
            [ match
             { [ and { $next-min } { [ propertyIs true lane.is-minimized ] } { [ propertyIs true was-pinned ] } { [ propertyIs false was-fullscreen ] } ] : !rails.pin $id }
            ]
            [ match
             { $was-fullscreen (
              !scope.enter-lane-fullscreen $id
              ; set $was-fs-pinned scope.fullscreen-was-pinned
             ) }
            ]
            [ match
             { $lane.open-modals (
              ; to modal-host !scope.get-lane-modal-host $lane
              ; each $lane.open-modals (
               ; to { open-m } $argv
               [ match
                { [ and { $open-m.backdrop } { $modal-host.appendChild } ] : !modal-host.appendChild $open-m.backdrop }
               ]
              )
             ) }
            ]
           ) }
          ]
         ) }
        ]
       ) }
      ]
     ) }
    ]
   ) : null
   !scope.end-session-status-pending
   [ match
    { [ and { $lane.reload-btn } { [ propertyIs $rseq lane.reload-seq ] } ] (
     ; set false lane.reload-btn.disabled
     ; set lane-reload-btn lane.reload-btn.className
    ) }
   ]
  ) }
 ]
 $lane
)
; to scope.close (
 -- Safely closes an open lane from the view while preserving its persisted data
 ; to { id } $argv
 ; to lane [ get scope.by-id $id ]
 [ match
  { $lane (
   !scope.begin-session-status-pending 'Saving…'
   ; try (
    [ match
     { $scope.fullscreen-lane (
      ; condition { propertyIs $id scope.fullscreen-lane.id } : !scope.exit-lane-fullscreen true
     ) }
    ]
    !scope.clear-lane-highlight $lane
    !scope.close-lane-modals $lane
    ; set null lane.load-task
    [ match
     { $lane.notebook.dispose : !lane.notebook.dispose }
    ]
    ; to was-minimized $lane.is-minimized
    !rails.remove $id
    [ match
     { $was-minimized : !lane.data.set minimized '' }
    ]
    !lane.element.remove
    [ match
     { $lane.body : !lane.body.remove }
    ]
    ; to lane-idx !scope.lanes.indexOf $lane
    ; condition { propertyIsGreaterThanOrEqual 0 lane-idx } : !scope.lanes.splice $lane-idx 1
    ; to id-idx !scope.lane-ids.indexOf $id
    ; condition { propertyIsGreaterThanOrEqual 0 id-idx } : !scope.lane-ids.splice $id-idx 1
    !window.Reflect.deleteProperty $scope.by-id $id
    ; to is-pref [ match
     { $scope.preferences-lane-id : [ propertyIs $id scope.preferences-lane-id ] }
     { true : false }
    ]
    [ match
     { [ propertyIs false is-pref ] (
      ; to prev-timer [ get scope.cron-timers $id ]
      [ match
       { $prev-timer (
        [ match
         { $window.clearInterval : !window.clearInterval $prev-timer }
        ]
        !window.Reflect.deleteProperty $scope.cron-timers $id
       ) }
      ]
     ) }
    ]
    !scope.update-url
   ) : null
   !scope.end-session-status-pending
  ) }
 ]
 $lane
)
; to scope.scroll-lane-into-view (
 -- Smoothly scrolls the viewport so the entire lane clears side rails horizontally and optional target-el is brought into view vertically
 ; to { lane target-el } $argv
 ; to rect-bounds (
  ; to { el } $argv
  [ match
   { $el.getBoundingClientRect (
    ; to r !el.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 r.width ] (
      ; to right [ match
       { [ propertyIs undefined r.right ] : ; add $r.left $r.width }
       { [ propertyIs null r.right ] : ; add $r.left $r.width }
       { true : $r.right }
      ]
      ; to top [ match
       { [ propertyIs undefined r.top ] : 0 }
       { [ propertyIs null r.top ] : 0 }
       { true : $r.top }
      ]
      ; to height [ match
       { [ propertyIsGreaterThan 0 r.height ] : $r.height }
       { true : 0 }
      ]
      ; to bottom [ match
       { [ propertyIs undefined r.bottom ] : ; add $top $height }
       { [ propertyIs null r.bottom ] : ; add $top $height }
       { true : $r.bottom }
      ]
      ; object { left $r.left } { right $right } { top $top } { bottom $bottom } { height $height }
     ) }
     { true : null }
    ]
   ) }
   { true : null }
  ]
 )
 ; to target-v-bounds (
  ; to { el } $argv
  [ match
   { $el.getBoundingClientRect (
    ; to r !el.getBoundingClientRect
    ; to has-top [ match
     { [ propertyIs null r.top ] : false }
     { [ propertyIs undefined r.top ] : false }
     { true : true }
    ]
    ; to has-dim [ match
     { [ propertyIsGreaterThan 0 r.height ] : true }
     { [ and { [ propertyIsGreaterThan 0 r.width ] } { $has-top } ] : true }
     { true : false }
    ]
    [ match
     { $has-dim (
      ; to top [ match
       { [ propertyIs undefined r.top ] : 0 }
       { [ propertyIs null r.top ] : 0 }
       { true : $r.top }
      ]
      ; to height [ match
       { [ propertyIsGreaterThan 0 r.height ] : $r.height }
       { true : 0 }
      ]
      ; to bottom [ match
       { [ propertyIs undefined r.bottom ] : ; add $top $height }
       { [ propertyIs null r.bottom ] : ; add $top $height }
       { true : $r.bottom }
      ]
      ; object { top $top } { bottom $bottom } { height $height }
     ) }
     { true : null }
    ]
   ) }
   { true : null }
  ]
 )
 ; to to-nonneg (
  ; to { val } $argv
  [ match
   { [ propertyIs null val ] : null }
   { [ propertyIs undefined val ] : null }
   { [ propertyIs '' val ] : null }
   { [ propertyIsGreaterThanOrEqual 0 val ] : $val }
   { true : null }
  ]
 )
 ; to to-pos (
  ; to { val } $argv
  [ match
   { [ propertyIs null val ] : 0 }
   { [ propertyIs undefined val ] : 0 }
   { [ propertyIs '' val ] : 0 }
   { [ propertyIsGreaterThan 0 val ] : $val }
   { true : 0 }
  ]
 )
 ; to do-scroll (
  [ match
   { [ and { $target-el } { $lane.notebook.auto-size-rows } ] : !lane.notebook.auto-size-rows }
  ]
  [ match
   { $lane.element (
    ; to el-rect !rect-bounds $lane.element
    ; to body-rect !rect-bounds $lane.body
    ; to target-rect [ match
     { $target-el : !target-v-bounds $target-el }
     { true : null }
    ]
    ; to has-rect [ match
     { $el-rect : true }
     { $body-rect : true }
     { true : false }
    ]
    ; to doc-w !to-pos $document.documentElement.clientWidth
    ; to win-w !to-pos $window.innerWidth
    ; to viewport-w [ match
     { [ propertyIsGreaterThan 0 doc-w ] : $doc-w }
     { true : $win-w }
    ]
    ; to doc-h !to-pos $document.documentElement.clientHeight
    ; to win-h !to-pos $window.innerHeight
    ; to viewport-h [ match
     { [ propertyIsGreaterThan 0 doc-h ] : $doc-h }
     { true : $win-h }
    ]
    ; to vx !to-nonneg $window.scrollX
    ; to dx !to-nonneg $document.documentElement.scrollLeft
    ; to cur-x [ match
     { [ propertyIs null vx ] (
      [ match
       { [ propertyIs null dx ] : 0 }
       { true : $dx }
      ]
     ) }
     { true : $vx }
    ]
    ; to vy !to-nonneg $window.scrollY
    ; to dy !to-nonneg $document.documentElement.scrollTop
    ; to cur-y [ match
     { [ propertyIs null vy ] (
      [ match
       { [ propertyIs null dy ] : 0 }
       { true : $dy }
      ]
     ) }
     { true : $vy }
    ]
    ; to target-y [ match
     { [ and { $target-rect } { [ propertyIsGreaterThan 0 viewport-h ] } { $computeLaneScrollTop } ] (
      !computeLaneScrollTop $cur-y $viewport-h $target-rect.top $target-rect.bottom
     ) }
     { [ and { $target-rect } { [ propertyIsGreaterThan 0 viewport-h ] } ] (
      ; to visible-top 48
      ; to visible-bottom ; subtract $viewport-h 64
      ; to already-visible [ and { propertyIsGreaterThan $visible-top visible-bottom } { propertyIsGreaterThanOrEqual $visible-top target-rect.top } { propertyIsLessThanOrEqual $visible-bottom target-rect.bottom } ]
      [ match
       { $already-visible : null }
       { true (
        ; to abs-top ; add $cur-y $target-rect.top
        ; to usable-h ; subtract $visible-bottom $visible-top
        ; to center-offset ; add $visible-top [ !window.Math.floor [ ; divide [ ; subtract $usable-h $target-rect.height ] 2 ] ]
        ; to raw-y !window.Math.round [ ; subtract $abs-top $center-offset ]
        ; to clamped-y !window.Math.max 0 $raw-y
        [ match
         { [ propertyIs $cur-y clamped-y ] : null }
         { true : $clamped-y }
        ]
       ) }
      ]
     ) }
     { true : null }
    ]
    ; to has-target-y [ match
     { [ propertyIs null target-y ] : false }
     { [ propertyIs undefined target-y ] : false }
     { true : true }
    ]
    [ match
     { $has-rect (
      [ match
       { [ propertyIsGreaterThan 0 viewport-w ] (
        ; to lane-left [ match
         { $el-rect (
          [ match
           { $body-rect : !window.Math.min $el-rect.left $body-rect.left }
           { true : $el-rect.left }
          ]
         ) }
         { true : $body-rect.left }
        ]
        ; to lane-right [ match
         { $el-rect (
          [ match
           { $body-rect : !window.Math.max $el-rect.right $body-rect.right }
           { true : $el-rect.right }
          ]
         ) }
         { true : $body-rect.right }
        ]
        ; to target-x !computeLaneScrollLeft $cur-x $viewport-w $lane-left $lane-right
        ; to has-target-x [ match
         { [ propertyIs null target-x ] : false }
         { [ propertyIs undefined target-x ] : false }
         { true : true }
        ]
        ; to resolved-x [ ternary $has-target-x $target-x $cur-x ]
        ; to resolved-y [ ternary $has-target-y $target-y $cur-y ]
        [ match
         { [ propertyIs true has-target-x ] (
          [ match
           { $window.scrollTo : !window.scrollTo [ object { left $resolved-x } { top $resolved-y } { behavior smooth } ] }
           { $document.documentElement (
            ; set $resolved-x document.documentElement.scrollLeft
            [ match
             { $has-target-y : ; set $resolved-y document.documentElement.scrollTop }
            ]
           ) }
          ]
         ) }
         { [ propertyIs true has-target-y ] (
          [ match
           { $window.scrollTo : !window.scrollTo [ object { left $resolved-x } { top $resolved-y } { behavior smooth } ] }
           { $document.documentElement : ; set $resolved-y document.documentElement.scrollTop }
          ]
         ) }
         { [ and { $target-el } { [ propertyIs null target-rect ] } { $target-el.scrollIntoView } ] (
          !target-el.scrollIntoView [ object { behavior smooth } { block center } { inline nearest } ]
         ) }
        ]
       ) }
       { [ and { $target-el } { $target-el.scrollIntoView } ] : !target-el.scrollIntoView [ object { behavior smooth } { block center } { inline nearest } ] }
       { $lane.element.scrollIntoView : !lane.element.scrollIntoView [ object { behavior smooth } { block nearest } { inline nearest } ] }
      ]
     ) }
     { [ and { $has-target-y } { $window.scrollTo } ] : !window.scrollTo [ object { left $cur-x } { top $target-y } { behavior smooth } ] }
     { [ and { $target-el } { $target-el.scrollIntoView } ] : !target-el.scrollIntoView [ object { behavior smooth } { block center } { inline nearest } ] }
     { $lane.element.scrollIntoView : !lane.element.scrollIntoView [ object { behavior smooth } { block nearest } { inline nearest } ] }
    ]
   ) }
  ]
 )
 [ match
  { $lane (
   [ match
    { $window.requestAnimationFrame (
     [ match
      { $scope.scroll-raf-id (
       [ match
        { $window.cancelAnimationFrame : !window.cancelAnimationFrame $scope.scroll-raf-id }
       ]
       ; set null scope.scroll-raf-id
      ) }
     ]
     ; to next-raf !window.requestAnimationFrame (
      ; set null scope.scroll-raf-id
      !do-scroll
     )
     ; set $next-raf scope.scroll-raf-id
    ) }
    { true : !do-scroll }
   ]
  ) }
 ]
)
; to resolve-target-package (
 -- Resolves the active package ID for newly created lanes, opening Default if none are open
 !scope.ensure-session
 [ match
  { $scope.active-package-id : $scope.active-package-id }
  { [ propertyIsGreaterThan 0 scope.open-package-ids.length ] : [ get scope.open-package-ids 0 ] }
  { true (
   !scope.open-package default '' true
   default
  ) }
 ]
)
; to scope.add (
 -- Creates, persists, registers in active package, and mounts a new lane
 !console.log lane-control--add $argv
 !scope.begin-session-status-pending 'Loading…'
 ; to lane null
 ; try (
  ; to pkg-id !resolve-target-package
  ; to id !crypto.randomUUID
  ; to number ; add $scope.lanes.length 1
  ; to title ; add 'Lane ' $number
  ; to lane-data !data.namespace $id
  ; set [ !scope.mount $id $title $lane-data undefined undefined undefined undefined undefined undefined $pkg-id ] lane
  !scope.update-url
  !lane-data.set title $title
  !scope.register $id $title $pkg-id
 ) : null
 !scope.end-session-status-pending
 !scope.scroll-lane-into-view $lane
 !console.log new lane $lane
 $lane
)
; to scope.move-lane-after (
 -- Moves an already-open lane (restoring if minimized) so it sits immediately to the right of anchor lane
 ; to { id after-id } $argv
 ; to lane [ get scope.by-id $id ]
 ; to anchor [ get scope.by-id $after-id ]
 [ match
  { $lane (
   ; condition { propertyIs true lane.is-minimized } : !scope.restore $id
   [ match
    { $anchor (
     ; to is-same [ propertyIs $id after-id ]
     ; condition { propertyIs false is-same } (
      ; to cur-idx !scope.lanes.indexOf $lane
      ; to anchor-idx !scope.lanes.indexOf $anchor
      ; condition { propertyIsGreaterThanOrEqual 0 anchor-idx } (
       ; to desired-idx ; add $anchor-idx 1
       ; to already-right [ propertyIs $cur-idx desired-idx ]
       ; condition { propertyIs false already-right } (
        ; condition { propertyIsGreaterThanOrEqual 0 cur-idx } : !scope.lanes.splice $cur-idx 1
        ; to id-idx !scope.lane-ids.indexOf $id
        ; condition { propertyIsGreaterThanOrEqual 0 id-idx } : !scope.lane-ids.splice $id-idx 1
        ; to next-anchor-idx !scope.lanes.indexOf $anchor
        ; to insert-idx ; add $next-anchor-idx 1
        ; to has-before [ propertyIsLessThan $scope.lanes.length insert-idx ]
        ; to before-lane [ match
         { $has-before : [ get scope.lanes $insert-idx ] }
         { true : null }
        ]
        [ match
         { $before-lane (
          !scope.lanes.splice $insert-idx 0 $lane
          !scope.lane-ids.splice $insert-idx 0 $id
         ) }
         { true (
          !scope.lanes.push $lane
          !scope.lane-ids.push $id
         ) }
        ]
        ; each $scope.lanes (
         ; to { item idx } $argv
         ; to num ; add $idx 1
         ; set $num item.number
        )
        [ match
         { $scope.move-lane-dom : !scope.move-lane-dom $lane $before-lane }
         { true (
          [ match
           { $lane.element.parentNode (
            [ match
             { $before-lane.element (
              [ match
               { $lane.element.parentNode.insertBefore : !lane.element.parentNode.insertBefore $lane.element $before-lane.element }
               { true : !lane.element.parentNode.appendChild $lane.element }
              ]
             ) }
             { true : !lane.element.parentNode.appendChild $lane.element }
            ]
           ) }
          ]
          [ match
           { $lane.body.parentNode (
            [ match
             { $before-lane.body (
              [ match
               { $lane.body.parentNode.insertBefore : !lane.body.parentNode.insertBefore $lane.body $before-lane.body }
               { true : !lane.body.parentNode.appendChild $lane.body }
              ]
             ) }
             { true : !lane.body.parentNode.appendChild $lane.body }
            ]
           ) }
          ]
         ) }
        ]
        !scope.recompute-session-dirty
       )
      )
     )
    ) }
   ]
  ) }
 ]
 $lane
)
; to scope.open (
 -- Loads or initializes a lane by ID on an optional tab and subroute (or mounts locked card if package access is denied), seeding missing default scrollbar preference when opening the active preferences lane
 ; to { id tab subroute after-id defer-notebook } $argv
 !scope.ensure-session
 !scope.begin-session-status-pending 'Loading…'
 ; to opened-lane null
 ; to open-entry null
 ; try (
  ; to open-cseq $scope.clear-seq
  ; to is-pref-lane [ match
   { $scope.preferences-lane-id : [ propertyIs $id scope.preferences-lane-id ] }
   { true : false }
  ]
  ; to existing [ get scope.by-id $id ]
  ; while { and { [ match { $existing : false } { true : true } ] } { [ propertyIs $open-cseq scope.clear-seq ] } { [ get scope.opening-by-id $id ] } } (
   ; to pending-open [ get scope.opening-by-id $id ]
   [ match
    { $pending-open.tracker.whenIdle : !pending-open.tracker.whenIdle }
   ]
   ; set [ get scope.by-id $id ] existing
  )
  [ match
   { $existing (
    [ match
     { [ propertyIs true existing.is-locked ] : null }
     { true (
      [ match
       { $existing.load-task.wait : !existing.load-task.wait }
      ]
      [ match
       { $is-pref-lane [ match
        { $existing.notebook.sync-records [ match
         { $seedPreferencesScrollbarRecords (
          ; to make-id : !generateLineId $window
          ; to seeded !seedPreferencesScrollbarRecords $existing.notebook.line-records $default-scrollbar-color $make-id
          [ match
           { $seeded.seeded (
            !existing.notebook.sync-records $seeded.records
            !scope.apply-preferences
           ) }
          ]
         ) }
        ] }
       ] }
      ]
      [ match
       { [ propertyIs undefined tab ] : null }
       { [ propertyIs null tab ] : null }
       { true (
        ; to normalized-tab !normalizeLaneTab $tab
        ; set $normalized-tab existing.tab
        ; to next-subroute [ match
         { $subroute : $subroute }
         { true : '' }
        ]
        ; set $next-subroute existing.subroute
        [ match
         { [ and { [ propertyIs data normalized-tab ] } { $existing.notebook.data-view.select-table-by-name } ] : !existing.notebook.data-view.select-table-by-name $next-subroute true }
        ]
        [ match
         { $existing.notebook.set-tab : !existing.notebook.set-tab $normalized-tab true }
        ]
       ) }
      ]
     ) }
    ]
    [ match
     { $after-id : !scope.move-lane-after $id $after-id }
    ]
    ; set $existing opened-lane
   ) }
   { [ propertyIs $open-cseq scope.clear-seq ] (
    [ match
     { $createIdleTracker (
      ; to tracker-inst !createIdleTracker
      ; to finish-fn !tracker-inst.begin
      ; to entry-inst [ object { tracker $tracker-inst } { finish $finish-fn } ]
      ; set $entry-inst open-entry
      ; to scope.opening-by-id $id $open-entry
     ) }
    ]
    ; to access !checkLaneAccess $data $scope.open-package-ids $id
    ; to insert-index [ match
     { $after-id (
      ; to anchor [ get scope.by-id $after-id ]
      [ match
       { $anchor (
        ; to anchor-idx !scope.lanes.indexOf $anchor
        [ match
         { [ propertyIsGreaterThanOrEqual 0 anchor-idx ] : ; add $anchor-idx 1 }
         { true : null }
        ]
       ) }
       { true : null }
      ]
     ) }
     { true : null }
    ]
    [ match
     { [ propertyIs false access.allowed ] (
      ; to still-ok [ and { [ propertyIs $open-cseq scope.clear-seq ] } { [ match { [ get scope.by-id $id ] : false } { true : true } ] } ]
      [ match
       { $still-ok : ; set [ !scope.mount-locked $id $access.packageId $tab $subroute $insert-index ] opened-lane }
       { [ get scope.by-id $id ] : ; set [ get scope.by-id $id ] opened-lane }
      ]
     ) }
     { true (
      ; to lane-data !data.namespace $id
      [ match
       { $is-pref-lane [ match
        { $seedPreferencesScrollbarRecords (
         ; to loaded-pref !loadLaneScript $data $lane-data $id $window
         ; to make-id : !generateLineId $window
         ; to seeded !seedPreferencesScrollbarRecords $loaded-pref.records $default-scrollbar-color $make-id
         [ match
          { $seeded.seeded : !saveLaneScript $data $lane-data $id $seeded.records $window null }
         ]
        ) }
       ] }
      ]
      ; to stored-title !lane-data.get title
      ; to stored-width !lane-data.get width
      ; to stored-minimized !lane-data.get minimized
      ; to stored-path-raw !lane-data.get path
      ; to stored-path !normalizeLanePath $stored-path-raw
      ; to stored-features-raw !lane-data.get features
      ; to parsed-features [ match
       { $parseLaneFeatures : !parseLaneFeatures $stored-features-raw }
       { true : ; object { httpServer false } { runEvery30Minutes false } }
      ]
      [ match
       { $scope.sync-lane-cron : !scope.sync-lane-cron $id $parsed-features }
      ]
      ; to parsed-stored-path !parseLanePath $stored-path
      ; to has-explicit-tab [ match
       { [ propertyIs undefined tab ] : false }
       { [ propertyIs null tab ] : false }
       { [ propertyIs '' tab ] : false }
       { true : true }
      ]
      ; to normalized-tab [ match
       { $has-explicit-tab : !normalizeLaneTab $tab }
       { $parsed-stored-path : $parsed-stored-path.tab }
       { true : !normalizeLaneTab $tab }
      ]
      ; to resolved-subroute [ match
       { $has-explicit-tab (
        [ match
         { $subroute : $subroute }
         { true : '' }
        ]
       ) }
       { $parsed-stored-path : $parsed-stored-path.subroute }
       { true : '' }
      ]
      ; to still-ok [ and { [ propertyIs $open-cseq scope.clear-seq ] } { [ match { [ get scope.by-id $id ] : false } { true : true } ] } ]
      [ match
       { $still-ok (
        ; to number ; add $scope.lanes.length 1
        ; to title [ match
         { $stored-title : $stored-title }
         { true (
          ; to default-title ; add 'Lane ' $number
          !lane-data.set title $default-title
          $default-title
         ) }
        ]
        !scope.register $id $title $access.packageId
        ; set [ !scope.mount $id $title $lane-data $normalized-tab $resolved-subroute $stored-width $stored-minimized $insert-index $stored-path $access.packageId $parsed-features $defer-notebook ] opened-lane
       ) }
       { [ get scope.by-id $id ] : ; set [ get scope.by-id $id ] opened-lane }
      ]
     ) }
    ]
   ) }
  ]
 ) (
  ; to { err } $argv
  [ match
   { [ and { $open-entry } { [ propertyIs $open-entry scope.opening-by-id $id ] } ] : ; to scope.opening-by-id $id null }
  ]
  [ match
   { $open-entry.finish : !open-entry.finish false }
  ]
  null
 )
 [ match
  { [ and { $open-entry } { [ propertyIs $open-entry scope.opening-by-id $id ] } ] : ; to scope.opening-by-id $id null }
 ]
 [ match
  { $open-entry.finish : !open-entry.finish true }
 ]
 !scope.end-session-status-pending
 $opened-lane
)
; to scope.open-after (
 -- Opens a lane (or moves and restores it if already open) immediately to the right of anchor lane and updates the URL
 ; to { id after-id tab subroute } $argv
 !scope.begin-session-status-pending 'Loading…'
 ; to lane null
 ; try (
  [ match
   { $scope.fullscreen-lane : !scope.exit-lane-fullscreen true }
  ]
  ; set [ !scope.open $id $tab $subroute $after-id ] lane
  [ match
   { $lane.is-minimized : !scope.restore $id }
  ]
  !scope.update-url
 ) : null
 !scope.end-session-status-pending
 !scope.scroll-lane-into-view $lane
 $lane
)
; to scope.clear (
 -- Removes all mounted lane elements and resets lane collections and side rails
 !scope.exit-lane-fullscreen true
 !scope.clear-lane-crons
 !rails.clear
 ; while { propertyIsGreaterThan 0 scope.lanes.length } (
  ; to removing !scope.lanes.pop
  !scope.close-lane-modals $removing
  ; set null removing.load-task
  [ match
   { $removing.notebook.dispose : !removing.notebook.dispose }
  ]
  !removing.element.remove
  [ match
   { $removing.body : !removing.body.remove }
  ]
 )
 ; set 0 scope.lane-ids.length
 ; to scope.by-id ; object
 ; to next-cseq ; add $scope.clear-seq 1
 ; set $next-cseq scope.clear-seq
 [ match
  { $window.Object.values (
   ; to pending-opens !window.Object.values $scope.opening-by-id
   ; each $pending-opens (
    ; to { entry } $argv
    [ match
     { $entry.finish : !entry.finish false }
    ]
   )
  ) }
 ]
 ; to scope.opening-by-id ; object
 [ match
  { $rails.sync-minimap : !rails.sync-minimap }
 ]
)
; to scope.sync (
 -- Synchronizes mounted lanes and their active tabs from the current URL pathname
 ; to next-sync-seq ; add $scope.sync-seq 1
 ; set $next-sync-seq scope.sync-seq
 !scope.begin-session-status-pending 'Loading…'
 ; try (
  !scope.clear
  ; to routes !parseLaneRoutes $location.pathname
  ; to bg-tasks {}
  ; each $routes (
   ; to { route } $argv
   [ match
    { [ propertyIs $next-sync-seq scope.sync-seq ] (
     ; try (
      ; to opened !scope.open $route.id $route.tab $route.subroute null true
      [ match
       { $opened.load-task : !bg-tasks.push $opened.load-task }
      ]
     ) (
      ; to { err } $argv
      [ match
       { $console.error : !console.error 'Failed to open lane:' $route.id $err }
      ]
      null
     )
    ) }
   ]
  )
  [ match
   { [ propertyIs $next-sync-seq scope.sync-seq ] (
    ; each $bg-tasks (
     ; to { bg-task } $argv
     ; try (
      [ match
       { $bg-task.wait : !bg-task.wait }
      ]
     ) (
      ; to { err } $argv
      [ match
       { $console.error : !console.error 'Failed to finish background lane load:' $err }
      ]
      null
     )
    )
   ) }
  ]
 ) (
  ; to { err } $argv
  [ match
   { $console.error : !console.error 'Failed to sync lanes:' $err }
  ]
  null
 )
 !scope.end-session-status-pending
)
; to scope.load-preferences-lane (
 -- Loads the global active preferences lane ID from root KV
 ; to stored !data.get preferences-lane
 ; to resolved [ match
  { [ propertyIs null stored ] : null }
  { [ propertyIs undefined stored ] : null }
  { true (
   ; to raw-str ; add '' $stored
   ; to trimmed !raw-str.trim
   [ match
    { [ propertyIs '' trimmed ] : null }
    { true : $trimmed }
   ]
  ) }
 ]
 ; set $resolved scope.preferences-lane-id
 [ match
  { $resolved : !scope.load-catalog }
 ]
 ; to scope.preferences-loading false
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 $resolved
)
; to read-stored-clock-key (
 -- Reads a clock preference key from workspace KV with localStorage fallback
 ; to { key-name } $argv
 ; to stored !data.get $key-name
 ; to fallback-local [ match
  { $window.localStorage.getItem : !window.localStorage.getItem $key-name }
  { true : null }
 ]
 [ match
  { [ propertyIs null stored ] : $fallback-local }
  { [ propertyIs undefined stored ] : $fallback-local }
  { [ propertyIs '' stored ] : $fallback-local }
  { true : $stored }
 ]
)
; to scope.get-clock-display-options (
 -- Resolves active clock display options ({ timeZone, shortZone, offset, label, selectedValue, hourFormat, showTimeZone, intl }) from clock preferences and preferences.timezones
 ; to raw-tz [ match
  { $scope.clock-timezone : $scope.clock-timezone }
  { true : browser }
 ]
 ; to raw-hr [ match
  { $scope.clock-hour-format : $scope.clock-hour-format }
  { true : '12h' }
 ]
 ; to tz-list [ match
  { [ propertyIsGreaterThan 0 scope.preferences-timezones.length ] : $scope.preferences-timezones }
  { [ propertyIsGreaterThan 0 rails.clock-timezones.length ] : $rails.clock-timezones }
  { [ !window.Array.isArray $scope.preferences-timezones ] : $scope.preferences-timezones }
  { true : {} }
 ]
 [ match
  { $resolveClockDisplayOptions : !resolveClockDisplayOptions $raw-tz $tz-list $raw-hr $window.Intl }
  { true (
   ; to fallback-tz [ match
    { [ and { [ propertyIs false [ propertyIs browser raw-tz ] ] } { [ propertyIs false [ propertyIs '' raw-tz ] ] } ] : $raw-tz }
    { $getBrowserTimeZone : !getBrowserTimeZone $window.Intl }
    { true : UTC }
   ]
   ; to fallback-hr [ match
    { $normalizeClockHourFormat : !normalizeClockHourFormat $raw-hr $window.Intl }
    { [ propertyIs '24h' raw-hr ] : '24h' }
    { true : '12h' }
   ]
   [ object
    { timeZone $fallback-tz }
    { shortZone $fallback-tz }
    { offset '' }
    { label $fallback-tz }
    { selectedValue $raw-tz }
    { hourFormat $fallback-hr }
    { showTimeZone true }
    { intl $window.Intl }
   ]
  ) }
 ]
)
; to scope.refresh-clock-displays (
 -- Refreshes all open timestamp displays (top-rail chip popover, mounted Data tables & Updates, Line Info modal, Session History, Server Last synced, Story timeline, and Row Picker)
 [ match
  { [ and { propertyIs true rails.is-chip-menu-open } { $rails.sync-chip-menu } ] : !rails.sync-chip-menu }
 ]
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.data-view.refresh-clock-displays : !lane.notebook.data-view.refresh-clock-displays }
  ]
  [ match
   { $lane.notebook.server-view.refresh-clock-displays : !lane.notebook.server-view.refresh-clock-displays }
  ]
  [ match
   { $lane.notebook.story-view.refresh-clock-displays : !lane.notebook.story-view.refresh-clock-displays }
  ]
 )
 [ match
  { [ and { propertyIs true line-info-modal.is-open } { $line-info-modal.refresh-timestamp } ] : !line-info-modal.refresh-timestamp }
 ]
 [ match
  { [ and { propertyIs true session-modal.is-open } { propertyIs history session-modal.mode } { $session-modal.render-history-page } ] : !session-modal.render-history-page }
 ]
 [ match
  { [ and { propertyIs true row-picker-modal.is-open } { $row-picker-modal.refresh-clock-displays } ] : !row-picker-modal.refresh-clock-displays }
 ]
)
; to scope.load-clock-timezone (
 -- Loads the selected top-rail clock timezone, 12/24-hour format, and show-seconds preferences from workspace KV (or localStorage fallback)
 ; to raw !read-stored-clock-key clock-timezone
 ; to resolved [ match
  { [ propertyIs null raw ] : browser }
  { [ propertyIs undefined raw ] : browser }
  { true (
   ; to raw-str ; add '' $raw
   ; to trimmed !raw-str.trim
   [ match
    { [ propertyIs '' trimmed ] : browser }
    { true : $trimmed }
   ]
  ) }
 ]
 ; to raw-hr !read-stored-clock-key clock-hour-format
 ; to resolved-hr [ match
  { $normalizeClockHourFormat : !normalizeClockHourFormat $raw-hr $window.Intl }
  { [ propertyIs '24h' raw-hr ] : '24h' }
  { [ propertyIs '24' raw-hr ] : '24h' }
  { true : '12h' }
 ]
 ; to raw-sec !read-stored-clock-key clock-show-seconds
 ; to resolved-sec [ match
  { $normalizeClockShowSeconds : !normalizeClockShowSeconds $raw-sec }
  { [ propertyIs false raw-sec ] : false }
  { [ propertyIs 'false' raw-sec ] : false }
  { true : true }
 ]
 ; set $resolved scope.clock-timezone
 ; set $resolved-hr scope.clock-hour-format
 ; set $resolved-sec scope.clock-show-seconds
 [ match
  { $rails.sync-clock : !rails.sync-clock }
 ]
 !scope.refresh-clock-displays
 $resolved
)
; to scope.set-clock-hour-format (
 -- Persists the top-rail clock 12h/24h preference to workspace KV and refreshes the clock
 ; to { raw-fmt } $argv
 ; to clean [ match
  { $normalizeClockHourFormat : !normalizeClockHourFormat $raw-fmt $window.Intl }
  { [ propertyIs '24h' raw-fmt ] : '24h' }
  { [ propertyIs '24' raw-fmt ] : '24h' }
  { [ propertyIs false raw-fmt ] : '24h' }
  { true : '12h' }
 ]
 ; set $clean scope.clock-hour-format
 !data.set clock-hour-format $clean
 [ match
  { $window.localStorage.setItem : !window.localStorage.setItem clock-hour-format $clean }
 ]
 [ match
  { $rails.sync-clock : !rails.sync-clock }
 ]
 [ match
  { [ and { propertyIs true rails.is-clock-open } { $rails.render-clock-options } ] : !rails.render-clock-options }
 ]
 !scope.refresh-clock-displays
 $clean
)
; to scope.set-clock-show-seconds (
 -- Persists the top-rail clock show-seconds preference to workspace KV and refreshes the clock
 ; to { raw-show } $argv
 ; to clean [ match
  { $normalizeClockShowSeconds : !normalizeClockShowSeconds $raw-show }
  { [ propertyIs false raw-show ] : false }
  { [ propertyIs 'false' raw-show ] : false }
  { true : true }
 ]
 ; to stored-str [ ternary $clean 'true' 'false' ]
 ; set $clean scope.clock-show-seconds
 !data.set clock-show-seconds $stored-str
 [ match
  { $window.localStorage.setItem : !window.localStorage.setItem clock-show-seconds $stored-str }
 ]
 [ match
  { $rails.sync-clock : !rails.sync-clock }
 ]
 [ match
  { [ and { propertyIs true rails.is-clock-open } { $rails.render-clock-options } ] : !rails.render-clock-options }
 ]
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.story-view.refresh-clock-displays : !lane.notebook.story-view.refresh-clock-displays }
  ]
 )
 $clean
)
; to scope.set-clock-timezone (
 -- Persists the selected top-rail clock timezone preference to workspace KV and refreshes the top-rail clock
 ; to { tz } $argv
 ; to clean [ match
  { [ propertyIs null tz ] : browser }
  { [ propertyIs undefined tz ] : browser }
  { true (
   ; to raw-str ; add '' $tz
   ; to trimmed !raw-str.trim
   [ match
    { [ propertyIs '' trimmed ] : browser }
    { true : $trimmed }
   ]
  ) }
 ]
 ; set $clean scope.clock-timezone
 !data.set clock-timezone $clean
 [ match
  { $window.localStorage.setItem : !window.localStorage.setItem clock-timezone $clean }
 ]
 [ match
  { $rails.sync-clock : !rails.sync-clock }
 ]
 !scope.refresh-clock-displays
 $clean
)
; to extract-tz-list (
 -- Extracts valid canonical timezone names from a table or array using extractTimezoneNames with a safe fallback
 ; to { raw-source } $argv
 [ match
  { [ propertyIs null raw-source ] : {} }
  { [ propertyIs undefined raw-source ] : {} }
  { $extractTimezoneNames : !extractTimezoneNames $raw-source $window.Intl }
  { [ !window.Array.isArray $raw-source ] (
   ; to out {}
   ; to seen ; object
   ; each $raw-source (
    ; to { entry } $argv
    ; to raw-name [ match
     { $entry.trim : !entry.trim }
     { $entry.name.trim : !entry.name.trim }
     { $entry.timezone.trim : !entry.timezone.trim }
     { true : '' }
    ]
    ; to already [ ternary [ get seen $raw-name ] true false ]
    ; condition { and { propertyIsGreaterThan 0 raw-name.length } { propertyIs false already } } (
     ; to seen $raw-name true
     !out.push $raw-name
    )
   )
   $out
  ) }
  { [ !window.Array.isArray $raw-source.rows ] (
   ; to cols [ match { [ !window.Array.isArray $raw-source.columns ] : $raw-source.columns } { true : {} } ]
   ; to name-col ; object { col null }
   ; each $cols (
    ; to { c } $argv
    ; to cname [ match { $c.name.trim ( ; to t !c.name.trim , !t.toLowerCase ) } { true : '' } ]
    ; condition { propertyIs name cname } : ; set $c name-col.col
   )
   ; to out {}
   ; to seen ; object
   [ match
    { $name-col.col (
     ; each $raw-source.rows (
      ; to { r } $argv
      ; to rv [ get r.values $name-col.col.id ]
      ; to clean-rv [ match { $rv.trim : !rv.trim } { true : '' } ]
      ; to already [ ternary [ get seen $clean-rv ] true false ]
      ; condition { and { propertyIsGreaterThan 0 clean-rv.length } { propertyIs false already } } (
       ; to seen $clean-rv true
       !out.push $clean-rv
      )
     )
    ) }
   ]
   $out
  ) }
  { true : {} }
 ]
)
; to scope.get-preferences-timezones (
 -- Resolves configured timezone names from the active preferences lane's timezones table (and optional evaluated state)
 ; to { pref-state } $argv
 ; to pref-id $scope.preferences-lane-id
 ; to merged {}
 ; to seen ; object
 ; to append-names (
  ; to { list } $argv
  [ match
   { [ !window.Array.isArray $list ] (
    ; each $list (
     ; to { tz } $argv
     ; to already [ ternary [ get seen $tz ] true false ]
     ; condition { and { propertyIsGreaterThan 0 tz.length } { propertyIs false already } } (
      ; to seen $tz true
      !merged.push $tz
     )
    )
   ) }
  ]
 )
 [ match
  { $pref-id (
   ; to open-pref [ get scope.by-id $pref-id ]
   ; to pref-data !data.namespace $pref-id
   ; to tables [ match
    { [ !window.Array.isArray $open-pref.notebook.data-view.tables ] : $open-pref.notebook.data-view.tables }
    { $loadLaneTables : !loadLaneTables $data $pref-data $pref-id }
    { true : {} }
   ]
   ; each $tables (
    ; to { tbl } $argv
    ; to tbl-name [ match
     { $tbl.name (
      ; to t-trim !tbl.name.trim
      !t-trim.toLowerCase
     ) }
     { true : '' }
    ]
    ; condition { propertyIs timezones tbl-name } (
     ; to from-tbl !extract-tz-list $tbl
     !append-names $from-tbl
    )
   )
  ) }
 ]
 [ match
  { $pref-state.timezones (
   ; to from-state !extract-tz-list $pref-state.timezones
   !append-names $from-state
  ) }
 ]
 [ match
  { $pref-state.interface.timezones (
   ; to from-iface !extract-tz-list $pref-state.interface.timezones
   !append-names $from-iface
  ) }
 ]
 $merged
)
; to scope.sync-preferences-timezones (
 -- Refreshes configured timezone names from the active preferences lane and syncs the top-rail clock selector
 ; to prev-disp !scope.get-clock-display-options
 ; to tz-names !scope.get-preferences-timezones $scope.preferences
 ; set $tz-names scope.preferences-timezones
 [ match
  { $scope.preferences : ; set $tz-names scope.preferences.timezones }
 ]
 [ match
  { $rails.set-timezones : !rails.set-timezones $tz-names }
 ]
 ; to next-disp !scope.get-clock-display-options
 ; to disp-changed [ match
  { [ propertyIs false [ propertyIs $prev-disp.timeZone next-disp.timeZone ] ] : true }
  { [ propertyIs false [ propertyIs $prev-disp.hourFormat next-disp.hourFormat ] ] : true }
  { true : false }
 ]
 ; condition { propertyIs true disp-changed } : !scope.refresh-clock-displays
 $tz-names
)
; to scope.refresh-preferences-from-storage (
 -- Evaluates the active preferences lane from stored script & tables without re-rendering its View output, and applies preferences to the interface
 ; to pref-id $scope.preferences-lane-id
 [ match
  { $pref-id (
   !scope.sync-lane-cron $pref-id
   ; to eval-res !scope.evaluate-stored-lane $pref-id
   [ match
    { $eval-res.ok (
     ; to open-pref [ get scope.by-id $pref-id ]
     [ match
      { $open-pref.notebook (
       ; set $eval-res.state open-pref.notebook.state
       [ match
        { $open-pref.notebook.scope-view.render : !open-pref.notebook.scope-view.render $eval-res.state }
       ]
      ) }
     ]
     !scope.apply-preferences-state $eval-res.state
    ) }
    { true : !scope.sync-preferences-timezones }
   ]
  ) }
  { true : null }
 ]
)
; to scope.apply-preferences-state (
 -- Applies evaluated preferences state (interface.backgroundColor, interface.scrollbarColor, top-rail chips, and timezones) to the document
 ; to { pref-state } $argv
 ; to raw-bg $pref-state.interface.backgroundColor
 ; to trimmed [ match
  { $raw-bg (
   [ match
    { $raw-bg.trim : !raw-bg.trim }
    { true : '' }
   ]
  ) }
  { true : '' }
 ]
 ; to resolved-bg [ match
  { [ propertyIs '' trimmed ] : $default-body-bg }
  { true : $trimmed }
 ]
 [ match
  { $document.body.style : ; set $resolved-bg document.body.style.backgroundColor }
 ]
 ; to resolved-sb [ match
  { $resolveScrollbarColor : !resolveScrollbarColor $pref-state.interface.scrollbarColor $default-scrollbar-color }
  { true (
   ; to fallback-css ; add $default-scrollbar-color ' transparent'
   ; object { color $default-scrollbar-color } { css $fallback-css } { thumb $default-scrollbar-color } { track transparent }
  ) }
 ]
 ; to root-style $document.documentElement.style
 [ match
  { $root-style (
   ; set $resolved-sb.css root-style.scrollbarColor
   [ match
    { $root-style.setProperty (
     !root-style.setProperty '--scrollbar-color' $resolved-sb.css
     [ match
      { [ propertyIs '' resolved-sb.thumb ] (
       [ match
        { $root-style.removeProperty (
         !root-style.removeProperty '--scrollbar-thumb-color'
         !root-style.removeProperty '--scrollbar-track-color'
        ) }
       ]
      ) }
      { true (
       !root-style.setProperty '--scrollbar-thumb-color' $resolved-sb.thumb
       !root-style.setProperty '--scrollbar-track-color' $resolved-sb.track
      ) }
     ]
    ) }
   ]
  ) }
 ]
 ; to top-elements [ match
  { [ !window.Array.isArray $pref-state.interface.rails.top.elements ] : $pref-state.interface.rails.top.elements }
  { true : {} }
 ]
 ; to top-order [ match
  { $normalizeTopRailOrder : !normalizeTopRailOrder $pref-state.interface.rails.top.order }
  { [ !window.Array.isArray $pref-state.interface.rails.top.order ] : $pref-state.interface.rails.top.order }
  { true : {} }
 ]
 ; to top-hidden [ match
  { $normalizeTopRailHidden : !normalizeTopRailHidden $pref-state.interface.rails.top.hidden }
  { [ !window.Array.isArray $pref-state.interface.rails.top.hidden ] : $pref-state.interface.rails.top.hidden }
  { true : {} }
 ]
 ; to prev-disp !scope.get-clock-display-options
 ; to tz-names !scope.get-preferences-timezones $pref-state
 ; set $tz-names scope.preferences-timezones
 [ match
  { $rails.set-top-layout : !rails.set-top-layout $top-order $top-hidden }
 ]
 [ match
  { $rails.set-top-elements : !rails.set-top-elements $top-elements }
 ]
 [ match
  { $rails.set-timezones : !rails.set-timezones $tz-names }
 ]
 ; to next-disp !scope.get-clock-display-options
 ; to disp-changed [ match
  { [ propertyIs false [ propertyIs $prev-disp.timeZone next-disp.timeZone ] ] : true }
  { [ propertyIs false [ propertyIs $prev-disp.hourFormat next-disp.hourFormat ] ] : true }
  { true : false }
 ]
 [ match
  { [ propertyIs true disp-changed ] : !scope.refresh-clock-displays }
  { [ and { propertyIs true rails.is-chip-menu-open } { $rails.sync-chip-menu } ] : !rails.sync-chip-menu }
 ]
 ; to prefs [ object
  { timezones $tz-names }
  { interface [ object
   { backgroundColor $resolved-bg }
   { scrollbarColor $resolved-sb.color }
   { rails [ object
    { top [ object
     { elements $top-elements }
     { order $top-order }
     { hidden $top-hidden }
    ] }
   ] }
  ] }
 ]
 ; set $prefs scope.preferences
 ; each $scope.lanes (
  ; to { ln } $argv
  [ match
   { $ln.notebook.output-view.sync-preferences : !ln.notebook.output-view.sync-preferences }
  ]
 )
 $prefs
)
; to cron-interval-ms [ match
 { [ propertyIsGreaterThan 0 LANE_CRON_INTERVAL_MS ] : $LANE_CRON_INTERVAL_MS }
 { true : 1800000 }
]
; to scope.clear-lane-crons (
 -- Clears all scheduled lane cron interval timers
 [ match
  { $window.Object.keys (
   ; to keys !window.Object.keys $scope.cron-timers
   ; each $keys (
    ; to { k } $argv
    ; to timer [ get scope.cron-timers $k ]
    [ match
     { [ and { $timer } { $window.clearInterval } ] : !window.clearInterval $timer }
    ]
    !window.Reflect.deleteProperty $scope.cron-timers $k
   )
  ) }
 ]
 ; to scope.cron-timers ; object
)
; to scope.run-lane-cron (
 -- Executes a single scheduled cron evaluation for a lane with a singleton lock so concurrent ticks never overlap
 ; to { id } $argv
 ; to clean-id [ match
  { $id (
   ; to s ; add '' $id
   !s.trim
  ) }
  { true : '' }
 ]
 ; to is-already-running [ get scope.cron-running $clean-id ]
 [ match
  { [ propertyIs '' clean-id ] : ; object { ok false } { skipped true } { reason 'empty-id' } }
  { [ propertyIs true is-already-running ] : ; object { ok false } { skipped true } { reason 'already-running' } }
  { true (
   ; to open-lane [ get scope.by-id $clean-id ]
   ; to nb-running [ match
    { $open-lane.notebook.is-running : !open-lane.notebook.is-running }
    { true : false }
   ]
   [ match
    { [ propertyIs true nb-running ] : ; object { ok false } { skipped true } { reason 'notebook-running' } }
    { true (
     ; to scope.cron-running $clean-id true
     ; to outcome null
     ; try (
      ; to is-pref [ match
       { $scope.preferences-lane-id : [ propertyIs $clean-id scope.preferences-lane-id ] }
       { true : false }
      ]
      ; to res [ match
       { $open-lane.notebook (
        ; to tab $open-lane.notebook.active-tab
        ; to is-non-run-tab [ match
         { [ propertyIs story tab ] : true }
         { [ propertyIs input tab ] : true }
         { [ propertyIs data tab ] : true }
         { true : false }
        ]
        [ match
         { $is-non-run-tab : !scope.evaluate-stored-lane $clean-id [ object { trigger cron } { applyExports true } ] }
         { true (
          ; to run-res !open-lane.notebook.run null false null [ object { trigger cron } ]
          ; object { ok true } { state $open-lane.notebook.state } { outcome $run-res }
         ) }
        ]
       ) }
       { true : !scope.evaluate-stored-lane $clean-id [ object { trigger cron } { applyExports true } ] }
      ]
      [ match
       { [ and { $is-pref } { $res.ok } ] : !scope.apply-preferences-state $res.state }
      ]
      ; set $res outcome
     ) (
      ; to { err } $argv
      ; set [ object { ok false } { error [ match { $err.message : $err.message } { true : ; add '' $err } ] } ] outcome
     )
     ; to scope.cron-running $clean-id false
     $outcome
    ) }
   ]
  ) }
 ]
)
; to scope.sync-lane-cron (
 -- Ensures at most one singleton 30-minute interval timer exists for a lane based on its runEvery30Minutes feature flag
 ; to { id raw-features } $argv
 ; to clean-id [ match
  { $id (
   ; to s ; add '' $id
   !s.trim
  ) }
  { true : '' }
 ]
 [ match
  { [ propertyIs '' clean-id ] : null }
  { true (
   ; to prev-timer [ get scope.cron-timers $clean-id ]
   [ match
    { $prev-timer (
     [ match
      { $window.clearInterval : !window.clearInterval $prev-timer }
     ]
     !window.Reflect.deleteProperty $scope.cron-timers $clean-id
    ) }
   ]
   ; to features [ match
    { $raw-features (
     [ match
      { $normalizeLaneFeatures : !normalizeLaneFeatures $raw-features }
      { true : $raw-features }
     ]
    ) }
    { true (
     ; to open-lane [ get scope.by-id $clean-id ]
     [ match
      { $open-lane.features : $open-lane.features }
      { true (
       ; to lane-data !data.namespace $clean-id
       ; to raw !lane-data.get features
       [ match
        { $parseLaneFeatures : !parseLaneFeatures $raw }
        { true : ; object { httpServer false } { runEvery30Minutes false } }
       ]
      ) }
     ]
    ) }
   ]
   ; to should-run [ propertyIs true features.runEvery30Minutes ]
   [ match
    { [ and { $should-run } { $window.setInterval } ] (
     ; to next-timer !window.setInterval (
      !scope.run-lane-cron $clean-id
     ) $cron-interval-ms
     ; to scope.cron-timers $clean-id $next-timer
     $next-timer
    ) }
    { true : null }
   ]
  ) }
 ]
)
; to scope.apply-preferences (
 -- Evaluates the global active preferences lane (if set), syncs its cron schedule, and applies preferences to the interface
 ; to pref-id $scope.preferences-lane-id
 [ match
  { $pref-id (
   !scope.sync-lane-cron $pref-id
   ; try (
    ; to res !scope.get-lane-final-state $pref-id
    [ match
     { $res.ok : !scope.apply-preferences-state $res.state }
     { true : !scope.apply-preferences-state null }
    ]
   ) : !scope.apply-preferences-state null
  ) }
  { true : !scope.apply-preferences-state null }
 ]
)
; to scope.find-preferences-chip-row (
 -- Locates the backing row in the active preferences lane's chips table matching a top-rail chip item
 ; to { item } $argv
 ; to pref-id $scope.preferences-lane-id
 [ match
  { [ and $pref-id $item ] (
   ; to target-row-id [ match
    { $item._rowId.trim : !item._rowId.trim }
    { $item.row._rowId.trim : !item.row._rowId.trim }
    { $item.rowId.trim : !item.rowId.trim }
    { true : '' }
   ]
   ; to target-url [ match
    { $item.url.trim : !item.url.trim }
    { $item.row.url.trim : !item.row.url.trim }
    { true : '' }
   ]
   ; to target-title [ match
    { $item.title.trim : !item.title.trim }
    { $item.row.title.trim : !item.row.title.trim }
    { true : '' }
   ]
   ; to open-pref [ get scope.by-id $pref-id ]
   ; to pref-data !data.namespace $pref-id
   ; to tables [ match
    { [ !window.Array.isArray $open-pref.notebook.data-view.tables ] : $open-pref.notebook.data-view.tables }
    { $loadLaneTables : !loadLaneTables $data $pref-data $pref-id }
    { true : {} }
   ]
   ; to found-tbl ; object { table null }
   ; each $tables (
    ; to { tbl } $argv
    ; to tbl-name [ match
     { $tbl.name (
      ; to t-trim !tbl.name.trim
      !t-trim.toLowerCase
     ) }
     { true : '' }
    ]
    ; condition { propertyIs chips tbl-name } : ; set $tbl found-tbl.table
   )
   ; to chips-tbl $found-tbl.table
   [ match
    { $chips-tbl (
     ; to cols [ match
      { [ !window.Array.isArray $chips-tbl.columns ] : $chips-tbl.columns }
      { true : {} }
     ]
     ; to col-map ; object { url null } { title null } { fetched null } { value null }
     ; each $cols (
      ; to { col } $argv
      ; to cname [ match
       { $col.name (
        ; to c-trim !col.name.trim
        !c-trim.toLowerCase
       ) }
       { true : '' }
      ]
      ; condition { propertyIs url cname } : ; set $col col-map.url
      ; condition { propertyIs title cname } : ; set $col col-map.title
      ; condition { propertyIs fetched cname } : ; set $col col-map.fetched
      ; condition { propertyIs value cname } : ; set $col col-map.value
     )
     ; to rows [ match
      { [ !window.Array.isArray $chips-tbl.rows ] : $chips-tbl.rows }
      { true : {} }
     ]
     ; to matched ; object { row null }
     ; each $rows (
      ; to { row } $argv
      ; condition { propertyIs null matched.row } (
       ; to row-url [ match
        { $col-map.url (
         ; to raw-u [ get row.values $col-map.url.id ]
         [ match { $raw-u.trim : !raw-u.trim } { $raw-u : ; add '' $raw-u } { true : '' } ]
        ) }
        { true : '' }
       ]
       ; to row-title [ match
        { $col-map.title (
         ; to raw-t [ get row.values $col-map.title.id ]
         [ match { $raw-t.trim : !raw-t.trim } { $raw-t : ; add '' $raw-t } { true : '' } ]
        ) }
        { true : '' }
       ]
       ; to is-match [ match
        { [ and { propertyIsGreaterThan 0 target-row-id.length } { propertyIs $target-row-id row.id } ] : true }
        { [ and { propertyIsGreaterThan 0 target-url.length } { propertyIs $target-url row-url } ] : true }
        { [ and { propertyIsGreaterThan 0 target-title.length } { propertyIs $target-title row-title } ] : true }
        { true : false }
       ]
       ; condition { propertyIs true is-match } : ; set $row matched.row
      )
     )
     [ match
      { $matched.row (
       [ object
        { found true }
        { prefId $pref-id }
        { prefData $pref-data }
        { openPref $open-pref }
        { tables $tables }
        { table $chips-tbl }
        { row $matched.row }
        { urlCol $col-map.url }
        { titleCol $col-map.title }
        { fetchedCol $col-map.fetched }
        { valueCol $col-map.value }
       ]
      ) }
      { true : ; object { found false } }
     ]
    ) }
    { true : ; object { found false } }
   ]
  ) }
  { true : ; object { found false } }
 ]
)
; to scope.get-top-rail-chip-row (
 -- Returns a clean JSON-serializable chip row object (including title, value, and fetched timestamp) for a top-rail chip
 ; to { item } $argv
 ; to lookup !scope.find-preferences-chip-row $item
 [ match
  { [ and $lookup.found $lookup.row $lookup.table ] (
   ; to out ; object
   ; to cols [ match
    { [ !window.Array.isArray $lookup.table.columns ] : $lookup.table.columns }
    { true : {} }
   ]
   ; each $cols (
    ; to { col } $argv
    ; to cname [ match { $col.name.trim : !col.name.trim } { true : '' } ]
    [ match
     { [ propertyIs '' cname ] : null }
     { true (
      ; to cval [ get lookup.row.values $col.id ]
      ; to resolved-val [ match
       { [ propertyIs undefined cval ] : '' }
       { [ propertyIs null cval ] : '' }
       { true : $cval }
      ]
      ; to out $cname $resolved-val
     ) }
    ]
   )
   [ match
    { [ propertyIs undefined out.title ] : [ match { $item.title : ; set $item.title out.title } ] }
    { [ propertyIs '' out.title ] : [ match { $item.title : ; set $item.title out.title } ] }
   ]
   [ match
    { [ propertyIs undefined out.value ] : [ match { [ propertyIs undefined item.value ] : null } { [ propertyIs null item.value ] : null } { true : ; set $item.value out.value } ] }
    { [ propertyIs '' out.value ] : [ match { [ propertyIs undefined item.value ] : null } { [ propertyIs null item.value ] : null } { [ propertyIs '' item.value ] : null } { true : ; set $item.value out.value } ] }
   ]
   [ match
    { [ propertyIs undefined out.fetched ] : [ match { $item.fetched : ; set $item.fetched out.fetched } ] }
    { [ propertyIs '' out.fetched ] : [ match { $item.fetched : ; set $item.fetched out.fetched } ] }
   ]
   $out
  ) }
  { [ and $item.row $window.Object.keys ] (
   ; to out ; object
   ; to rkeys !window.Object.keys $item.row
   ; each $rkeys (
    ; to { k } $argv
    ; to v [ get item.row $k ]
    ; to v-json [ match { $window.JSON.stringify : ; try ( !window.JSON.stringify $v ) : undefined } { true : ok } ]
    ; condition { [ propertyIs false [ propertyIs undefined v-json ] ] } : ; to out $k $v
   )
   [ match
    { $item.title : ; set $item.title out.title }
   ]
   [ match
    { [ propertyIs undefined item.value ] : null }
    { [ propertyIs null item.value ] : null }
    { true : ; set $item.value out.value }
   ]
   [ match
    { $item.fetched : ; set $item.fetched out.fetched }
   ]
   $out
  ) }
  { [ and $item $window.Object.keys ] (
   ; to out ; object
   ; to ikeys !window.Object.keys $item
   ; each $ikeys (
    ; to { k } $argv
    ; to v [ get item $k ]
    ; to v-json [ match { $window.JSON.stringify : ; try ( !window.JSON.stringify $v ) : undefined } { true : ok } ]
    ; to is-row-prop [ propertyIs row k ]
    ; condition { and { [ propertyIs false [ propertyIs undefined v-json ] ] } { propertyIs false is-row-prop } } : ; to out $k $v
   )
   $out
  ) }
  { true : ; object { title [ match { $item : ; add '' $item } { true : '' } ] } { value [ match { $item : ; add '' $item } { true : '' } ] } { fetched '' } }
 ]
)
; to scope.run-preferences-lane-now (
 -- Re-runs the active preferences lane (either via its open runnable notebook or headless stored evaluation) and applies its state
 ; to pref-id $scope.preferences-lane-id
 [ match
  { $pref-id (
   ; to open-pref [ get scope.by-id $pref-id ]
   ; to is-runnable-open [ match
    { $open-pref.notebook (
     ; to tab $open-pref.notebook.active-tab
     [ match
      { [ propertyIs story tab ] : false }
      { [ propertyIs input tab ] : false }
      { [ propertyIs data tab ] : false }
      { true : true }
     ]
    ) }
    { true : false }
   ]
   [ match
    { $is-runnable-open (
     !open-pref.notebook.run null false null [ object { trigger preferences } ]
     !scope.apply-preferences-state $open-pref.notebook.state
    ) }
    { true (
     ; to eval-res !scope.evaluate-stored-lane $pref-id [ object { trigger preferences } { applyExports true } ]
     [ match
      { $eval-res.ok (
       [ match
        { $open-pref.notebook (
         ; set $eval-res.state open-pref.notebook.state
         [ match
          { $open-pref.notebook.scope-view.render : !open-pref.notebook.scope-view.render $eval-res.state }
         ]
        ) }
       ]
       !scope.apply-preferences-state $eval-res.state
      ) }
     ]
    ) }
   ]
  ) }
 ]
)
; to scope.sync-top-rail-chip (
 -- Forces an immediate sync for a clicked top-rail chip, persists updated value and fetched timestamp to the chips table, and refreshes top-rail elements
 ; to { item } $argv
 [ match
  { [ propertyIs null item ] : ; object { ok false } }
  { [ propertyIs undefined item ] : ; object { ok false } }
  { true (
   [ match
    { [ and { $item.onSync } { [ propertyIs false [ propertyIs true item.onSync.__ccSandboxedStub ] ] } ] : ; try ( !item.onSync $item ) : null }
   ]
   ; to target-url [ match
    { $item.url.trim : !item.url.trim }
    { $item.row.url.trim : !item.row.url.trim }
    { true : '' }
   ]
   ; to lookup !scope.find-preferences-chip-row $item
   ; to prev-fetched [ match
    { [ and $lookup.found $lookup.row $lookup.fetchedCol ] (
     ; to pf [ get lookup.row.values $lookup.fetchedCol.id ]
     [ match { $pf.trim : !pf.trim } { $pf : ; add '' $pf } { true : '' } ]
    ) }
    { true : '' }
   ]
   [ match
    { [ and $lookup.found $lookup.row $lookup.fetchedCol ] (
     ; to lookup.row.values $lookup.fetchedCol.id ''
     [ match
      { $saveTableSchemaAndRows : !saveTableSchemaAndRows $data $lookup.prefData $lookup.prefId $lookup.table }
     ]
     [ match
      { $lookup.openPref.notebook.data-view.render-grid : !lookup.openPref.notebook.data-view.render-grid }
     ]
    ) }
   ]
   !scope.run-preferences-lane-now
   ; to after-lookup !scope.find-preferences-chip-row $item
   ; to after-fetched [ match
    { [ and $after-lookup.found $after-lookup.row $after-lookup.fetchedCol ] (
     ; to rf [ get after-lookup.row.values $after-lookup.fetchedCol.id ]
     [ match { $rf.trim : !rf.trim } { $rf : ; add '' $rf } { true : '' } ]
    ) }
    { true : '' }
   ]
   ; to need-direct-fetch [ match
    { [ propertyIs '' target-url ] : false }
    { [ propertyIs false after-lookup.found ] : true }
    { [ propertyIs '' after-fetched ] : true }
    { true : false }
   ]
   ; to direct-synced ; object { ok false }
   ; to use-proxy-fetch [ ternary [ and { $data.isProxyBacked } { $data.externalFetch } ] true false ]
   ; to can-fetch [ match
    { $use-proxy-fetch : true }
    { $window.fetch : true }
    { true : false }
   ]
   ; condition { and { propertyIs true need-direct-fetch } { propertyIs true can-fetch } } (
    ; try (
     ; to res [ match
      { $use-proxy-fetch : !data.externalFetch $target-url }
      { true : !window.fetch $target-url }
     ]
     [ match
      { $res.ok (
       ; to txt !res.text
       ; to clean-txt [ match { $txt.trim : !txt.trim } { true : ; add '' $txt } ]
       [ match
        { [ propertyIs '' clean-txt ] : null }
        { true (
         ; to now-dt !window.Reflect.construct $window.Date {}
         ; to now-iso !now-dt.toISOString
         ; set true direct-synced.ok
         ; set $clean-txt item.value
         ; set $now-iso item.fetched
         [ match
          { $item.row (
           ; set $clean-txt item.row.value
           ; set $now-iso item.row.fetched
          ) }
         ]
         [ match
          { [ and $after-lookup.found $after-lookup.row ] (
           [ match
            { $after-lookup.valueCol : ; to after-lookup.row.values $after-lookup.valueCol.id $clean-txt }
           ]
           [ match
            { $after-lookup.fetchedCol : ; to after-lookup.row.values $after-lookup.fetchedCol.id $now-iso }
           ]
           [ match
            { $saveTableSchemaAndRows : !saveTableSchemaAndRows $data $after-lookup.prefData $after-lookup.prefId $after-lookup.table }
           ]
           [ match
            { $after-lookup.openPref.notebook.data-view.render-grid : !after-lookup.openPref.notebook.data-view.render-grid }
           ]
           !scope.run-preferences-lane-now
          ) }
          { true (
           ; to pfx [ match { $item.prefix : $item.prefix } { true : '' } ]
           ; to fmt-val [ match
            { [ propertyIs fixed_2 item.format ] (
             ; to num !window.Number $clean-txt
             [ match
              { [ !window.Number.isFinite $num ] (
               ; to scaled ; divide $num 100
               !scaled.toFixed 2
              ) }
              { true : $clean-txt }
             ]
            ) }
            { [ propertyIs decimal item.format ] (
             ; to num !window.Number.parseFloat $clean-txt
             [ match
              { [ !window.Number.isFinite $num ] : ; add '' $num }
              { true : $clean-txt }
             ]
            ) }
            { [ propertyIs integer item.format ] (
             ; to num !window.Number.parseInt $clean-txt 10
             [ match
              { [ !window.Number.isFinite $num ] : ; add '' $num }
              { true : $clean-txt }
             ]
            ) }
            { [ propertyIs json item.format ] (
             ; to parsed ; object { ok false } { val null }
             ; try (
              ; set [ !window.JSON.parse $clean-txt ] parsed.val
              ; set true parsed.ok
             ) : null
             [ match
              { [ propertyIs false parsed.ok ] : $clean-txt }
              { true (
               ; to cur ; object { val $parsed.val }
               ; to opts [ match { $item.format_options : $item.format_options } { $item.row.format_options : $item.row.format_options } { true : null } ]
               ; to path-str [ match { $opts.json.path.trim : !opts.json.path.trim } { true : '' } ]
               ; to has-path [ match { [ propertyIs '' path-str ] : false } { true : true } ]
               [ match
                { [ propertyIs true has-path ] (
                 ; to parts !path-str.split '.'
                 ; each $parts (
                  ; to { seg } $argv
                  ; to has-seg [ match { [ propertyIs '' seg ] : false } { true : true } ]
                  ; condition { propertyIs true has-seg } (
                   [ match
                    { [ propertyIs null cur.val ] : null }
                    { [ propertyIs undefined cur.val ] : null }
                    { true : ; set [ get cur.val $seg ] cur.val }
                   ]
                  )
                 )
                ) }
               ]
               ; to out-val $cur.val
               [ match
                { [ propertyIs null out-val ] : '' }
                { [ propertyIs undefined out-val ] : '' }
                { $out-val.trim : ; add '' $out-val }
                { $out-val.toFixed : ; add '' $out-val }
                { [ propertyIs true out-val ] : 'true' }
                { [ propertyIs false out-val ] : 'false' }
                { true : !window.JSON.stringify $out-val }
               ]
              ) }
             ]
            ) }
            { true : $clean-txt }
           ]
           ; set [ ternary [ propertyIs '' fmt-val ] '' [ add $pfx $fmt-val ] ] item.text
           [ match
            { $rails.set-top-elements : !rails.set-top-elements $scope.preferences.interface.rails.top.elements }
           ]
          ) }
         ]
        ) }
       ]
      ) }
     ]
    ) : null
   )
   [ match
    { [ and { propertyIs false direct-synced.ok } { propertyIs '' after-fetched } { propertyIsGreaterThan 0 prev-fetched.length } ] (
     ; to restore-lookup !scope.find-preferences-chip-row $item
     [ match
      { [ and $restore-lookup.found $restore-lookup.row $restore-lookup.fetchedCol ] (
       ; to restore-lookup.row.values $restore-lookup.fetchedCol.id $prev-fetched
       [ match
        { $saveTableSchemaAndRows : !saveTableSchemaAndRows $data $restore-lookup.prefData $restore-lookup.prefId $restore-lookup.table }
       ]
       [ match
        { $restore-lookup.openPref.notebook.data-view.render-grid : !restore-lookup.openPref.notebook.data-view.render-grid }
       ]
       !scope.run-preferences-lane-now
      ) }
     ]
    ) }
   ]
   ; to row-data !scope.get-top-rail-chip-row $item
   ; object { ok true } { row $row-data }
  ) }
 ]
)
; to scope.set-preferences-lane (
 -- Sets or clears the global system-wide preferences lane ID without modifying its script, and applies preferences
 ; to { id } $argv
 ; to prev-id $scope.preferences-lane-id
 ; to normalized [ match
  { [ propertyIs null id ] : null }
  { [ propertyIs undefined id ] : null }
  { true (
   ; to raw-str ; add '' $id
   ; to trimmed !raw-str.trim
   [ match
    { [ propertyIs '' trimmed ] : null }
    { true : $trimmed }
   ]
  ) }
 ]
 ; set $normalized scope.preferences-lane-id
 [ match
  { [ and { $prev-id } { [ propertyIs false [ propertyIs $prev-id normalized ] ] } ] (
   ; to prev-open [ get scope.by-id $prev-id ]
   [ match
    { $prev-open : !scope.sync-lane-cron $prev-id }
    { true (
     ; to old-timer [ get scope.cron-timers $prev-id ]
     [ match
      { $old-timer (
       [ match
        { $window.clearInterval : !window.clearInterval $old-timer }
       ]
       !window.Reflect.deleteProperty $scope.cron-timers $prev-id
      ) }
     ]
    ) }
   ]
  ) }
 ]
 ; to stored [ match
  { $normalized : $normalized }
  { true : '' }
 ]
 !data.set preferences-lane $stored
 !scope.apply-preferences
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 $normalized
)
; to scope.create-preferences-lane (
 -- Creates a new lane seeded with default interface preferences and assigns it as the global active preferences lane
 !scope.begin-session-status-pending 'Loading…'
 ; to lane null
 ; try (
  ; to pkg-id !resolve-target-package
  ; to id !crypto.randomUUID
  ; to title 'Preferences'
  ; to lane-data !data.namespace $id
  ; to bg-line ; add '; to interface.backgroundColor ' $default-body-bg
  ; to sb-line ; add '; to interface.scrollbarColor ' $default-scrollbar-color
  ; to seed-lines { '; to interface ; object' $bg-line $sb-line }
  !saveLaneScript $data $lane-data $id $seed-lines $window
  !lane-data.set title $title
  !scope.register $id $title $pkg-id
  ; set $id scope.preferences-lane-id
  !data.set preferences-lane $id
  ; set [ !scope.mount $id $title $lane-data undefined undefined undefined undefined undefined undefined $pkg-id ] lane
  !scope.update-url
 ) : null
 !scope.end-session-status-pending
 !scope.apply-preferences
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 !scope.scroll-lane-into-view $lane
 $lane
)
; to scope.open-preferences-lane (
 -- Opens (and restores if minimized) the global active preferences lane
 ; to pref-id $scope.preferences-lane-id
 [ match
  { $pref-id (
   !scope.begin-session-status-pending 'Loading…'
   ; to lane null
   ; try (
    ; set [ !scope.open $pref-id ] lane
    [ match
     { $lane.is-minimized : !scope.restore $pref-id }
    ]
    !scope.update-url
   ) : null
   !scope.end-session-status-pending
   !scope.scroll-lane-into-view $lane
   $lane
  ) }
  { true : null }
 ]
)
; to scope.open-preferences-timezones-view (
 -- Opens (and restores if minimized) the global active preferences lane directly on its View tab
 ; to pref-id $scope.preferences-lane-id
 [ match
  { $pref-id (
   !scope.begin-session-status-pending 'Loading…'
   ; to lane null
   ; try (
    ; set [ !scope.open $pref-id view ] lane
    [ match
     { $lane.is-minimized : !scope.restore $pref-id }
    ]
    !scope.update-url
   ) : null
   !scope.end-session-status-pending
   !scope.scroll-lane-into-view $lane
   $lane
  ) }
  { true : null }
 ]
)
; to scope.handle-agent-event (
 -- Handles real-time Server-Sent Events emitted when an agent creates or modifies a lane over /api/agent/* or ./cc
 ; to { ev } $argv
 [ match
  { $ev (
   ; to ev-type $ev.type
   ; to target-id $ev.laneId
   [ match
    { [ propertyIs 'lane-story-added' ev-type ] (
     [ match
      { $target-id (
       ; to open-lane [ get scope.by-id $target-id ]
       [ match
        { $open-lane.notebook.story-view.on-new-entry : !open-lane.notebook.story-view.on-new-entry null }
       ]
      ) }
     ]
    ) }
    { [ propertyIs 'lane-updated' ev-type ] (
     !scope.load-catalog
     [ match
      { $target-id (
       ; to open-lane [ get scope.by-id $target-id ]
       [ match
        { $open-lane : !scope.reload $target-id }
       ]
       ; to has-remote-deps ; object { hit false }
       ; each $scope.lanes (
        ; to { dep-l } $argv
        ; to is-self-dep [ propertyIs $dep-l.id target-id ]
        ; condition { propertyIs false is-self-dep } (
         [ match
          { $dep-l.notebook.data-view.has-remote-from-lane (
           ; to uses-t !dep-l.notebook.data-view.has-remote-from-lane $target-id
           ; condition { propertyIs true uses-t } : ; set true has-remote-deps.hit
          ) }
         ]
        )
       )
       [ match
        { $has-remote-deps.hit (
         ; to owner-tbls [ match
          { $open-lane.notebook.data-view.tables : $open-lane.notebook.data-view.tables }
          { true : !loadLaneTables $data [ !data.namespace $target-id ] $target-id [ object { openPackageIds $scope.open-package-ids } ] }
         ]
         !scope.notify-table-dependents $target-id $owner-tbls $target-id [ object { action $ev.action } { tableId $ev.tableId } ]
        ) }
       ]
       [ match
        { $scope.preferences-lane-id (
         ; condition { propertyIs $target-id scope.preferences-lane-id } : !scope.apply-preferences
        ) }
       ]
      ) }
     ]
    ) }
    { [ propertyIs 'lane-created' ev-type ] (
     !scope.load-catalog
     ; to matches-session [ match
      { [ propertyIs null ev.sessionId ] : true }
      { [ propertyIs undefined ev.sessionId ] : true }
      { [ propertyIs '' ev.sessionId ] : true }
      { [ propertyIs $scope.session-id ev.sessionId ] : true }
      { true : false }
     ]
     [ match
      { $matches-session (
       [ match
        { $target-id (
         ; to already [ get scope.by-id $target-id ]
         [ match
          { $already : !scope.reload $target-id }
          { true (
           !scope.begin-session-status-pending 'Loading…'
           ; try (
            !scope.open $target-id
            !scope.update-url
           ) : null
           !scope.end-session-status-pending
          ) }
         ]
        ) }
       ]
      ) }
     ]
    ) }
    { [ propertyIs 'export-unlock-required' ev-type ] (
     ; to matches-session [ match
      { [ propertyIs null ev.sessionId ] : true }
      { [ propertyIs undefined ev.sessionId ] : true }
      { [ propertyIs '' ev.sessionId ] : true }
      { [ propertyIs $scope.session-id ev.sessionId ] : true }
      { true : false }
     ]
     [ match
      { [ and { $matches-session } { [ propertyIs false package-modal.is-open ] } { $ev.lockedPackages } { [ propertyIsGreaterThan 0 ev.lockedPackages.length ] } ] (
       !scope.prompt-unlock-packages-for-export [ object
        { locked-packages $ev.lockedPackages }
        { source-lane-id $target-id }
        { source-lane-title $ev.laneTitle }
        { pending-exports $ev.pendingExports }
       ]
      ) }
     ]
     [ match
      { $target-id : !scope.refresh-export-statuses $target-id }
     ]
    ) }
    { [ propertyIs 'package-opened' ev-type ] (
     ; to matches-session [ match
      { [ propertyIs null ev.sessionId ] : true }
      { [ propertyIs undefined ev.sessionId ] : true }
      { [ propertyIs '' ev.sessionId ] : true }
      { [ propertyIs $scope.session-id ev.sessionId ] : true }
      { true : false }
     ]
     [ match
      { $matches-session (
       ; to already-has [ match
        { $ev.packageId : [ !scope.open-package-ids.includes $ev.packageId ] }
        { true : false }
       ]
       [ match
        { [ propertyIs false already-has ] (
         ; to refreshed [ match
          { [ and { $switchTabSession } { $scope.session-id } ] : !switchTabSession $data $window $scope.session-id }
          { $initSessionState : !initSessionState $data $window }
          { true : null }
         ]
         [ match
          { $refreshed (
           !scope.apply-session-packages $refreshed
           !scope.load-catalog
           !scope.refresh-lane-labels
           ; to locked-hit ; object { val false }
           ; each $scope.lanes (
            ; to { lane } $argv
            ; condition { propertyIs true lane.is-locked } : ; set true locked-hit.val
           )
           [ match
            { $locked-hit.val : !scope.sync }
           ]
           !refresh-pending-export-lanes
           !sync-session-ui
          ) }
         ]
        ) }
       ]
      ) }
     ]
    ) }
   ]
  ) }
 ]
)
; to scope.handle-before-unload (
 -- Prompts browser confirmation before unloading or leaving the page while the active session has an unsaved version or pending status
 ; to { ev } $argv
 [ match
  { [ propertyIs true scope.session-status-pending ] (
   ; to msg 'Session status is still loading or saving. Please wait before leaving.'
   [ match
    { $ev (
     [ match
      { $ev.preventDefault : !ev.preventDefault }
     ]
     ; set $msg ev.returnValue
    ) }
   ]
   $msg
  ) }
  { [ propertyIs true scope.session-dirty ] (
   ; to msg 'This session has an unsaved version. Save, fork, or abandon before leaving.'
   [ match
    { $ev (
     [ match
      { $ev.preventDefault : !ev.preventDefault }
     ]
     ; set $msg ev.returnValue
    ) }
   ]
   $msg
  ) }
  { true : undefined }
 ]
)
; to scope.init (
 -- Initializes session & packages, reconciles initial URL lane routes, subscribes to popstate, beforeunload, and agent SSE events, loads global preferences, syncs URL lanes, and applies preferences
 !scope.begin-session-status-pending 'Loading…'
 ; to scope.preferences-loading true
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 ; try (
  !scope.init-session
  ; to initial-routes !parseLaneRoutes $location.pathname
  ; to saved-is-empty [ match
   { [ propertyIs '/' scope.saved-pathname ] : true }
   { [ propertyIs '' scope.saved-pathname ] : true }
   { true : false }
  ]
  [ match
   { [ and { propertyIsGreaterThan 0 initial-routes.length } { propertyIs true saved-is-empty } ] (
    ; to initial-ids {}
    ; each $initial-routes (
     ; to { r } $argv
     !initial-ids.push $r.id
    )
    ; to initial-pathname !formatLaneRoutes $initial-routes
    ; to base-opts [ object
     { laneIds $initial-ids }
     { pathname $initial-pathname }
     { openPackageIds !copy-id-list $scope.open-package-ids }
     { activePackageId $scope.active-package-id }
     { incrementVersion false }
    ]
    ; to saved-res !saveSessionVersion $data $window $scope.session-id $base-opts
    [ match
     { $saved-res (
      ; set [ !copy-id-list $saved-res.laneIds ] scope.saved-lane-ids
      ; set [ match { $saved-res.pathname : $saved-res.pathname } { true : $initial-pathname } ] scope.saved-pathname
      ; set $saved-res.recentSessions scope.recent-sessions
      [ match
       { $saved-res.sessionHistory : ; set $saved-res.sessionHistory scope.session-history }
      ]
      !scope.apply-session-packages $saved-res
     ) }
    ]
   ) }
   { [ and { propertyIs 0 initial-routes.length } { propertyIs false saved-is-empty } ] : !navigate-to-session-pathname $scope.saved-pathname }
  ]
  !scope.load-preferences-lane
  !scope.load-clock-timezone
  !window.addEventListener popstate $scope.sync
  !window.addEventListener beforeunload $scope.handle-before-unload
  !scope.sync
 ) (
  ; to { err } $argv
  [ match
   { $console.error : !console.error 'Failed to initialize session:' $err }
  ]
  null
 )
 !scope.end-session-status-pending
 ; to scope.preferences-loading false
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 !scope.apply-preferences
 [ match
  { $subscribeAgentEvents : !subscribeAgentEvents $scope.handle-agent-event $window }
 ]
 ; to dirs-disabled !scope.is-session-dirs-disabled
 [ match
  { [ and { propertyIs false dirs-disabled } { propertyIs false scope.session-data-dir-confirmed } ] : !dir-modal.open-confirm }
 ]
)
!console.log $scope
$scope
