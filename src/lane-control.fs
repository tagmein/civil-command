-- file lane-control.fs
; to lane-notebook ; load /src/lane-notebook.fs
; to lane-inputs ; load /src/lane-inputs.fs
; to lane-config-modal ; load /src/lane-config-modal.fs
; to lane-import-modal ; load /src/lane-import-modal.fs
; to lane-modal-mod ; load /src/lane-modal.fs
; to confirm-modal-mod ; load /src/confirm-modal.fs
; to row-picker-modal-mod ; load /src/lane-row-picker-modal.fs
; to lane-session-modal-mod ; load /src/lane-session-modal.fs
; to lane-package-modal-mod ; load /src/lane-package-modal.fs
; to lane-line-info-mod ; load /src/lane-line-info-modal.fs
; to lane-rails ; load /src/lane-rails.fs
; to default-body-bg '#202020'
; to default-scrollbar-color [ match
 { $defaultScrollbarColor : $defaultScrollbarColor }
 { true : '#383838' }
]
; to scope [ object
 { lanes {} }
 { lane-ids {} }
 { by-id ; object }
 { catalog ; object }
 { active-imports ; object }
 { preferences-lane-id null }
 { preferences ; object }
 { scroll-raf-id null }
 { session-id null }
 { browser-session-id null }
 { session-overridden false }
 { session-meta ; object }
 { open-package-ids {} }
 { open-packages {} }
 { active-package-id '' }
 { saved-lane-ids {} }
 { saved-pathname '/' }
 { saved-package-ids {} }
 { saved-active-package-id '' }
 { session-dirty false }
 { recent-sessions {} }
 { session-history {} }
 { workspace-summary null }
]
; to config-modal !lane-config-modal.create $scope
; set $config-modal scope.config-modal
; to import-modal !lane-import-modal.create $scope
; set $import-modal scope.import-modal
; to lane-modal !lane-modal-mod.create $scope
; set $lane-modal scope.lane-modal
; to confirm-modal !confirm-modal-mod.create
; set $confirm-modal scope.confirm-modal
; to row-picker-modal !row-picker-modal-mod.create
; set $row-picker-modal scope.row-picker-modal
; to session-modal !lane-session-modal-mod.create $scope
; set $session-modal scope.session-modal
; to package-modal !lane-package-modal-mod.create $scope
; set $package-modal scope.package-modal
; to line-info-modal !lane-line-info-mod.create
; set $line-info-modal scope.line-info-modal
; to rails !lane-rails.create $scope
; set $rails scope.rails
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
; to sync-session-ui (
 -- Refreshes top-rail session/packages menus and the left workspace summary panel
 [ match
  { $rails.sync-session-menu : !rails.sync-session-menu }
 ]
 [ match
  { $rails.sync-packages-menu : !rails.sync-packages-menu }
 ]
 [ match
  { $scope.sync-workspace-summary : !scope.sync-workspace-summary }
 ]
)
; to scope.recompute-session-dirty (
 -- Recomputes whether current lane routes (open lanes, order, tabs, selected data tables) or open packages differ from the session's last saved version
 ; to cur-pathname !formatLaneRoutes $scope.lanes
 ; to saved-path [ match
  { $scope.saved-pathname : $scope.saved-pathname }
  { true : '/' }
 ]
 ; to routes-same [ propertyIs $cur-pathname saved-path ]
 ; to pkgs-same !arrays-equal $scope.open-package-ids $scope.saved-package-ids
 ; to is-dirty [ match
  { [ propertyIs false routes-same ] : true }
  { [ propertyIs false pkgs-same ] : true }
  { true : false }
 ]
 ; set $is-dirty scope.session-dirty
 !sync-session-ui
 $is-dirty
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
; to scope.apply-session-state (
 -- Updates full session state and saved baseline on scope from storage session helper results
 ; to { sess } $argv
 [ match
  { $sess (
   ; set $sess.sessionId scope.session-id
   ; set $sess.browserSessionId scope.browser-session-id
   ; set [ ternary $sess.isOverridden true false ] scope.session-overridden
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
   ; set false scope.session-dirty
   !scope.apply-session-packages $sess
  ) }
 ]
 $sess
)
; to scope.init-session (
 -- Initializes two-level browser/tab session state, migrates legacy catalog, and loads open packages
 ; to sess !initSessionState $data $window
 !scope.apply-session-state $sess
 !scope.load-catalog
 !sync-session-ui
 $sess
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
 !scope.load-catalog
 [ match
  { $navigate-lanes : !navigate-to-session-pathname $scope.saved-pathname }
 ]
 !scope.sync
 !scope.recompute-session-dirty
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 !scope.apply-preferences
)
; to scope.new-session (
 -- Creates a new session (browser + tab by default), switches to it, and navigates to its lanes
 ; to { name } $argv
 ; to opts [ object { name $name } { tabOnly false } ]
 ; to sess !createNewSession $data $window $opts
 !scope.apply-session-state $sess
 !refresh-after-session-change true
 $sess
)
; to scope.switch-session (
 -- Switches active session (browser + tab), redirecting browser URL to that session's open lanes
 ; to { id } $argv
 ; to sess !switchBrowserSession $data $window $id
 !scope.apply-session-state $sess
 !refresh-after-session-change true
 $sess
)
; to scope.new-tab-session (
 -- Creates a new tab-only session in sessionStorage without altering the localStorage browser session
 ; to { name } $argv
 ; to sess !createNewTabSession $data $window $name
 !scope.apply-session-state $sess
 !refresh-after-session-change true
 $sess
)
; to scope.switch-tab-session (
 -- Switches the active tab session in sessionStorage only and navigates to its lanes
 ; to { id } $argv
 ; to sess !switchTabSession $data $window $id
 !scope.apply-session-state $sess
 !refresh-after-session-change true
 $sess
)
; to scope.return-to-browser-session (
 -- Clears the tab override, returns sessionStorage to the saved localStorage browser session, and navigates to its lanes
 ; to sess !returnToBrowserSession $data $window
 !scope.apply-session-state $sess
 !refresh-after-session-change true
 $sess
)
; to scope.promote-tab-session (
 -- Promotes the current tab session ID to become the persistent localStorage browser session
 ; to sess !promoteTabToBrowserSession $data $window
 !scope.apply-session-state $sess
 !refresh-after-session-change false
 $sess
)
; to scope.switch-browser-session (
 -- Switches both the persistent localStorage browser session and active sessionStorage tab session and navigates to its lanes
 ; to { id } $argv
 ; to sess !switchBrowserSession $data $window $id
 !scope.apply-session-state $sess
 !refresh-after-session-change true
 $sess
)
; to scope.save-session-draft (
 -- Commits current working lane routes (including tabs and selected data tables) and packages as the next saved version of the active session
 !scope.ensure-session
 ; to cur-pathname !formatLaneRoutes $scope.lanes
 ; to opts [ object
  { laneIds !copy-id-list $scope.lane-ids }
  { pathname $cur-pathname }
  { openPackageIds !copy-id-list $scope.open-package-ids }
  { activePackageId $scope.active-package-id }
  { incrementVersion true }
 ]
 ; to res !saveSessionVersion $data $window $scope.session-id $opts
 [ match
  { $res (
   ; set [ !copy-id-list $res.laneIds ] scope.saved-lane-ids
   ; set [ match { $res.pathname : $res.pathname } { true : $cur-pathname } ] scope.saved-pathname
   ; set [ !copy-id-list $res.openPackageIds ] scope.saved-package-ids
   ; set $res.activePackageId scope.saved-active-package-id
   ; set $res.recentSessions scope.recent-sessions
   [ match
    { $res.sessionHistory : ; set $res.sessionHistory scope.session-history }
   ]
   !scope.apply-session-packages $res
  ) }
 ]
 !scope.recompute-session-dirty
 $res
)
; to scope.fork-session (
 -- Forks the current working lane routes (including tabs and selected data tables) and packages into a new session while leaving the original session at its last saved version
 ; to { name tab-only } $argv
 !scope.ensure-session
 ; to cur-pathname !formatLaneRoutes $scope.lanes
 ; to opts [ object
  { name $name }
  { laneIds !copy-id-list $scope.lane-ids }
  { pathname $cur-pathname }
  { openPackageIds !copy-id-list $scope.open-package-ids }
  { activePackageId $scope.active-package-id }
  { tabOnly [ ternary $tab-only true false ] }
  { restoreSourcePackageIds !copy-id-list $scope.saved-package-ids }
  { restoreSourceActivePackageId $scope.saved-active-package-id }
 ]
 ; to sess !forkSession $data $window $scope.session-id $opts
 !scope.apply-session-state $sess
 !refresh-after-session-change true
 $sess
)
; to scope.abandon-session-draft (
 -- Reverts working lane routes and packages back to the session's last saved version and redirects URL
 !scope.ensure-session
 ; to opts [ object
  { laneIds !copy-id-list $scope.saved-lane-ids }
  { pathname $scope.saved-pathname }
  { openPackageIds !copy-id-list $scope.saved-package-ids }
  { activePackageId $scope.saved-active-package-id }
  { incrementVersion false }
 ]
 ; to res !saveSessionVersion $data $window $scope.session-id $opts
 [ match
  { $res (
   ; set [ !copy-id-list $res.laneIds ] scope.saved-lane-ids
   ; set [ match { $res.pathname : $res.pathname } { true : '/' } ] scope.saved-pathname
   ; set [ !copy-id-list $res.openPackageIds ] scope.saved-package-ids
   ; set $res.activePackageId scope.saved-active-package-id
   ; set $res.recentSessions scope.recent-sessions
   [ match
    { $res.sessionHistory : ; set $res.sessionHistory scope.session-history }
   ]
   !scope.apply-session-packages $res
  ) }
 ]
 !refresh-after-session-change true
 $res
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
; to scope.create-package (
 -- Creates a new optionally passphrase-protected package and opens it in the active session (marking draft dirty)
 ; to { name passphrase } $argv
 !scope.ensure-session
 ; to opts [ object { name $name } { passphrase $passphrase } ]
 ; to res !createPackage $data $scope.session-id $opts $window
 [ match
  { $res.sessionState : !scope.apply-session-packages $res.sessionState }
 ]
 !scope.load-catalog
 !scope.recompute-session-dirty
 $res
)
; to scope.open-package (
 -- Opens a package (verifying passphrase if required) in the active session and unlocks any locked mounted lanes
 ; to { package-id passphrase set-active } $argv
 !scope.ensure-session
 ; to should-activate [ match
  { [ propertyIs false set-active ] : false }
  { true : true }
 ]
 ; to opts [ object { packageId $package-id } { passphrase $passphrase } { setActive $should-activate } ]
 ; to res !openPackageInSession $data $scope.session-id $opts $window
 [ match
  { $res.ok (
   !scope.apply-session-packages $res.sessionState
   !scope.load-catalog
   !scope.recompute-session-dirty
   ; to has-locked ; object { hit false }
   ; each $scope.lanes (
    ; to { lane } $argv
    ; condition { propertyIs true lane.is-locked } : ; set true has-locked.hit
   )
   [ match
    { $has-locked.hit (
     !scope.sync
     !scope.apply-preferences
    ) }
   ]
  ) }
 ]
 $res
)
; to scope.close-package (
 -- Closes a package in the active session and immediately enforces lock access control on open lanes
 ; to { package-id } $argv
 !scope.ensure-session
 ; to sess-rec !closePackageInSession $data $scope.session-id $package-id
 !scope.apply-session-packages $sess-rec
 !refresh-after-session-change false
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
 ; to lane [ get scope.by-id $id ]
 ; to from-pkg [ match
  { $lane.package-id : $lane.package-id }
  { true : !getLanePackageId $data $id }
 ]
 ; to title [ match
  { $lane.title : $lane.title }
  { true : $id }
 ]
 ; to entry !moveLaneToPackage $data $id $title $from-pkg $next-package-id
 [ match
  { $lane : ; set $entry.packageId lane.package-id }
 ]
 !scope.load-catalog
 !sync-session-ui
 ; to still-open [ !scope.open-package-ids.includes $entry.packageId ]
 [ match
  { [ propertyIs false still-open ] : !scope.sync }
 ]
 $entry
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
   !quick-row.appendChild $quick-switch-btn
   !quick-row.appendChild $quick-fork-btn
   !quick-row.appendChild $quick-history-btn

   !sess-sec.appendChild $sess-hdr
   !sess-sec.appendChild $sess-id-el
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

   ; to pkg-list !document.createElement div
   ; set workspace-pkg-list pkg-list.className
   !pkg-sec.appendChild $pkg-hdr
   !pkg-sec.appendChild $pkg-list

   !panel.appendChild $sess-sec
   !panel.appendChild $pkg-sec
   !host-el.appendChild $panel

   !sess-name-btn.addEventListener click : !session-modal.open-switch-session
   !draft-save-btn.addEventListener click : !scope.save-session-draft
   !draft-fork-btn.addEventListener click : !scope.fork-session
   !draft-abandon-btn.addEventListener click : !scope.abandon-session-draft
   !quick-switch-btn.addEventListener click : !session-modal.open-switch-session
   !quick-fork-btn.addEventListener click : !scope.fork-session
   !quick-history-btn.addEventListener click : !session-modal.open-history
   !pkg-add-btn.addEventListener click : !package-modal.open-packages

   ; to summary [ object
    { panel $panel }
    { session-card $sess-sec }
    { packages-card $pkg-sec }
    { sess-name-btn $sess-name-btn }
    { sess-ver $sess-ver }
    { sess-id-el $sess-id-el }
    { draft-box $draft-box }
    { draft-save-btn $draft-save-btn }
    { draft-fork-btn $draft-fork-btn }
    { draft-abandon-btn $draft-abandon-btn }
    { quick-switch-btn $quick-switch-btn }
    { quick-fork-btn $quick-fork-btn }
    { quick-history-btn $quick-history-btn }
    { pkg-add-btn $pkg-add-btn }
    { pkg-list $pkg-list }
    { pkg-els {} }
    { pkg-items {} }
   ]
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
   ; to sname [ match
    { $scope.session-meta.name : $scope.session-meta.name }
    { $sid : $sid }
    { true : Session }
   ]
   ; to ver [ match
    { $scope.session-meta.version : ; add v $scope.session-meta.version }
    { true : v1 }
   ]
   ; to ver-txt [ match
    { [ propertyIs true scope.session-dirty ] : ; add $ver '*' }
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
   ; set [ ternary $scope.session-dirty false true ] summary.draft-box.hidden

   ; while { propertyIsGreaterThan 0 summary.pkg-els.length } (
    ; to old !summary.pkg-els.pop
    !old.remove
   )
   ; set 0 summary.pkg-items.length

   ; to pkgs [ match
    { $scope.open-packages : $scope.open-packages }
    { true : {} }
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
   !scope.sync-minimized-labels $lane
   !lane.data.set title $title
   !scope.register $id $title $lane.package-id
   !scope.refresh-import-labels $id
   !scope.refresh-lane-labels $id
   [ match
    { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
   ]
  ) }
 ]
 $lane
)
; to clear-lane-box-width (
 -- Clears inline width and --lane-width overrides on a lane header or body cell
 ; to { el } $argv
 [ match
  { $el.style (
   ; set '' el.style.width
   ; set '' el.style.maxWidth
   ; set '' el.style.minWidth
   [ match
    { $el.style.removeProperty : !el.style.removeProperty '--lane-width' }
    { true : ; set '' el.style.--lane-width }
   ]
  ) }
 ]
)
; to scope.apply-lane-width (
 -- Applies a lane's stored Width setting to header and body elements (clamping rendered width to >= 100px with no max)
 ; to { lane raw-width } $argv
 [ match
  { $lane (
   ; to normalized !normalizeLaneWidth $raw-width
   ; to rendered !resolveLaneRenderedWidth $normalized
   ; set $normalized lane.width
   ; set $rendered lane.rendered-width
   ; condition { propertyIs false lane.is-minimized } (
    ; to has-width [ match
     { [ propertyIs null rendered ] : false }
     { true : true }
    ]
    ; to px-str [ match
     { $has-width : ; add $rendered px }
     { true : '' }
    ]
    [ match
     { $lane.element (
      ; set [ ternary $has-width 'lane-header lane-header--sized' lane-header ] lane.element.className
      [ match
       { $lane.element.style (
        ; set $px-str lane.element.style.width
        ; set $px-str lane.element.style.maxWidth
        ; set [ ternary $has-width 100px '' ] lane.element.style.minWidth
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
      ; set [ ternary $has-width 'lane-body lane-body--sized' lane-body ] lane.body.className
      [ match
       { $lane.body.style (
        ; set $px-str lane.body.style.width
        ; set $px-str lane.body.style.maxWidth
        ; set [ ternary $has-width 100px '' ] lane.body.style.minWidth
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
      { $rails.preview-lane (
       ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
      ) }
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
    ) }
   ]
  ) }
 ]
 $lane
)
; to scope.restore (
 -- Restores a minimized lane back to its original position with its previous width and state
 ; to { id skip-save } $argv
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
      !scope.scroll-lane-into-view $lane
     ) }
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
; to scope.pick-lane (
 -- Opens the full-screen lane picker modal for selecting a lane ID
 ; to { opts } $argv
 !lane-modal.open-picker $opts
)
; to scope.refresh-import-labels (
 -- Updates import picker button labels across all open lanes after a lane rename
 ; to { id } $argv
 ; each $scope.lanes (
  ; to { lane } $argv
  [ match
   { $lane.notebook.refresh-import-labels : !lane.notebook.refresh-import-labels $id }
  ]
 )
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
 ; to { target-id } $argv
 ; to target-data !data.namespace $target-id
 ; to loaded-script !loadLaneScript $data $target-data $target-id $window
 ; to lines {}
 ; each $loaded-script.records (
  ; to { rec } $argv
  !lines.push $rec.text
 )
 ; to stored-inputs !target-data.get inputs
 ; to inputs !lane-inputs.parse-stored $stored-inputs
 ; to tables !loadLaneTables $data $target-data $target-id
 ; to env [ object
  { console $console }
  { data $target-data }
  { Math $window.Math }
  { JSON $window.JSON }
  { Date $window.Date }
  { importLane (
   ; to { nested-id ...nested-path } $argv
   [ match
    { [ propertyIs '' nested-id ] : undefined }
    { [ propertyIs undefined nested-id ] : undefined }
    { true (
     ; to res !scope.get-lane-final-state $nested-id $target-id
     !resolveImportValue $res $nested-path
    ) }
   ]
  ) }
 ]
 ; each $inputs (
  ; to { entry } $argv
  ; to trimmed !entry.name.trim
  [ match
   { [ propertyIs '' trimmed ] : null }
   { true (
    ; to val !defaultValueForType $entry.type
    ; to env $trimmed $val
   ) }
  ]
 )
 ; to scoped-tables !buildTablesScope $tables
 ; assign $env $scoped-tables
 ; to run-opts [ object { filename $target-id } { initialState $env } ]
 ; to outcome !runLines $lines $run-opts
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
  { is-resizing false }
  { is-minimized false }
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
 $lane
)
; to scope.mount (
 -- Mounts a lane DOM header, gear config button, minimize buttons, reload button, close button, resize handles, notebook body, and registers it on scope
 ; to { id title lane-data initial-tab initial-subroute initial-width initial-minimized insert-index initial-path package-id } $argv
 ; to resolved-pkg [ match
  { $package-id : $package-id }
  { true : default }
 ]
 ; to tab !normalizeLaneTab $initial-tab
 ; to subroute [ match
  { $initial-subroute : $initial-subroute }
  { true : '' }
 ]
 ; to path !normalizeLanePath $initial-path
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
 ; assign element.style { textAlign left } { verticalAlign top } { padding '0.25em 0.75em' }
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
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-close-btn } { textContent '×' } { title 'Close lane' }
 !close-btn.addEventListener click : !scope.close $id
 !header-top.appendChild $config-btn
 !header-top.appendChild $meta-el
 !header-top.appendChild $min-left-btn
 !header-top.appendChild $min-right-btn
 !header-top.appendChild $reload-btn
 !header-top.appendChild $close-btn
 !element.appendChild $header-top
 ; to header-resizer !document.createElement div
 !element.appendChild $header-resizer
 ; to lane [ object
  { id $id }
  { package-id $resolved-pkg }
  { is-locked false }
  { tab $tab }
  { subroute $subroute }
  { path $path }
  { title $title }
  { width null }
  { rendered-width null }
  { is-resizing false }
  { is-minimized false }
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
  { min-left-btn $min-left-btn }
  { min-right-btn $min-right-btn }
  { reload-btn $reload-btn }
  { close-btn $close-btn }
 ]
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
   !lane-notebook.mount $lane $body-el $scope $tab
   ; to body-resizer !document.createElement div
   ; set $body-resizer lane.body-resizer
   !scope.attach-lane-resizer $lane $body-resizer
   !body-el.appendChild $body-resizer
  ) }
 ]
 !scope.apply-lane-width $lane $initial-width
 ; to norm-min !normalizeLaneMinimizeSide $initial-minimized
 [ match
  { $norm-min : !scope.minimize $id $norm-min true }
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
   !scope.ensure-session
   ; to access !checkLaneAccess $data $scope.open-package-ids $id
   [ match
    { [ propertyIs true lane.is-locked ] (
     ; condition { propertyIs true access.allowed } : !scope.sync
    ) }
    { [ propertyIs false access.allowed ] : !scope.sync }
    { true (
     [ match
      { $rails.preview-lane (
       ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
      ) }
     ]
     ; set $access.packageId lane.package-id
     ; to was-minimized $lane.is-minimized
     ; to raw-tab [ match
      { $lane.notebook.active-tab : $lane.notebook.active-tab }
      { true : $lane.tab }
     ]
     ; to current-tab !normalizeLaneTab $raw-tab
     ; set $current-tab lane.tab
     ; to stored-title !lane.data.get title
     ; to stored-width !lane.data.get width
     ; to stored-minimized !lane.data.get minimized
     ; to stored-path-raw !lane.data.get path
     ; to stored-path !normalizeLanePath $stored-path-raw
     ; set $stored-path lane.path
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
     !scope.apply-lane-width $lane $stored-width
     [ match
      { $lane.body (
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
       ; set null lane.minimized-placeholder
       ; set null lane.minimized-title-el
       !lane-notebook.mount $lane $lane.body $scope $current-tab
       [ match
        { $lane.body-resizer : !lane.body.appendChild $lane.body-resizer }
       ]
       [ match
        { [ propertyIs input current-tab ] : !scope.notify-lane-idle $id }
        { [ propertyIs data current-tab ] : !scope.notify-lane-idle $id }
       ]
      ) }
     ]
     [ match
      { $next-min : !scope.minimize $id $next-min true }
      { $was-minimized : !scope.restore $id true }
     ]
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
   !scope.update-url
   !scope.recompute-session-dirty
  ) }
 ]
 $lane
)
; to scope.scroll-lane-into-view (
 -- Smoothly scrolls the horizontal viewport so the entire lane (header and body) clears side rails with right breathing room
 ; to { lane } $argv
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
      ; object { left $r.left } { right $right }
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
   { $lane.element (
    ; to el-rect !rect-bounds $lane.element
    ; to body-rect !rect-bounds $lane.body
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
        ; to target-x !computeLaneScrollLeft $cur-x $viewport-w $lane-left $lane-right
        [ match
         { [ propertyIs null target-x ] : null }
         { [ propertyIs undefined target-x ] : null }
         { $window.scrollTo : !window.scrollTo [ object { left $target-x } { top $cur-y } { behavior smooth } ] }
         { $document.documentElement : ; set $target-x document.documentElement.scrollLeft }
        ]
       ) }
       { $lane.element.scrollIntoView : !lane.element.scrollIntoView [ object { behavior smooth } { block nearest } { inline nearest } ] }
      ]
     ) }
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
 ; to pkg-id !resolve-target-package
 ; to id !crypto.randomUUID
 ; to number ; add $scope.lanes.length 1
 ; to title ; add 'Lane ' $number
 ; to lane-data !data.namespace $id
 ; to lane !scope.mount $id $title $lane-data undefined undefined undefined undefined undefined undefined $pkg-id
 !scope.update-url
 !lane-data.set title $title
 !scope.register $id $title $pkg-id
 !scope.recompute-session-dirty
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
 ; to { id tab subroute after-id } $argv
 !scope.ensure-session
 ; to is-pref-lane [ match
  { $scope.preferences-lane-id : [ propertyIs $id scope.preferences-lane-id ] }
  { true : false }
 ]
 ; to existing [ get scope.by-id $id ]
 [ match
  { $existing (
   [ match
    { [ propertyIs true existing.is-locked ] : null }
    { true (
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
   $existing
  ) }
  { true (
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
    { [ propertyIs false access.allowed ] : !scope.mount-locked $id $access.packageId $tab $subroute $insert-index }
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
     ; to lane !scope.mount $id $title $lane-data $normalized-tab $resolved-subroute $stored-width $stored-minimized $insert-index $stored-path $access.packageId
     !scope.recompute-session-dirty
     $lane
    ) }
   ]
  ) }
 ]
)
; to scope.open-after (
 -- Opens a lane (or moves and restores it if already open) immediately to the right of anchor lane and updates the URL
 ; to { id after-id tab subroute } $argv
 ; to lane !scope.open $id $tab $subroute $after-id
 [ match
  { $lane.is-minimized : !scope.restore $id }
 ]
 !scope.update-url
 !scope.recompute-session-dirty
 !scope.scroll-lane-into-view $lane
 $lane
)
; to scope.clear (
 -- Removes all mounted lane elements and resets lane collections and side rails
 !rails.clear
 ; while { propertyIsGreaterThan 0 scope.lanes.length } (
  ; to removing !scope.lanes.pop
  !removing.element.remove
  [ match
   { $removing.body : !removing.body.remove }
  ]
 )
 ; set 0 scope.lane-ids.length
 ; to scope.by-id ; object
)
; to scope.sync (
 -- Synchronizes mounted lanes and their active tabs from the current URL pathname
 !scope.clear
 ; to routes !parseLaneRoutes $location.pathname
 ; each $routes (
  ; to { route } $argv
  !scope.open $route.id $route.tab $route.subroute
 )
 !scope.recompute-session-dirty
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
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 $resolved
)
; to scope.apply-preferences-state (
 -- Applies evaluated preferences state (interface.backgroundColor and interface.scrollbarColor) to the document
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
 ; to prefs [ object
  { interface [ object
   { backgroundColor $resolved-bg }
   { scrollbarColor $resolved-sb.color }
  ] }
 ]
 ; set $prefs scope.preferences
 $prefs
)
; to scope.apply-preferences (
 -- Evaluates the global active preferences lane (if set) and applies preferences to the interface
 ; to pref-id $scope.preferences-lane-id
 [ match
  { $pref-id (
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
; to scope.set-preferences-lane (
 -- Sets or clears the global system-wide preferences lane ID without modifying its script, and applies preferences
 ; to { id } $argv
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
 ; to lane !scope.mount $id $title $lane-data undefined undefined undefined undefined undefined undefined $pkg-id
 !scope.update-url
 !scope.recompute-session-dirty
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
   ; to lane !scope.open $pref-id
   [ match
    { $lane.is-minimized : !scope.restore $pref-id }
   ]
   !scope.update-url
   !scope.recompute-session-dirty
   !scope.scroll-lane-into-view $lane
   $lane
  ) }
  { true : null }
 ]
)
; to scope.init (
 -- Initializes session & packages, reconciles initial URL lane routes, subscribes to popstate, loads global preferences, syncs URL lanes, and applies preferences
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
 !window.addEventListener popstate $scope.sync
 !scope.sync
 !sync-session-ui
 [ match
  { $rails.sync-preferences-menu : !rails.sync-preferences-menu }
 ]
 !scope.apply-preferences
)
!console.log $scope
$scope
