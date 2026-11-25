-- file lane-export-deploy-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a modal for reviewing diffs and deploying changed Export-to-Lane target lanes
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-import-backdrop' backdrop.className
 ; to panel !document.createElement div
 ; set 'lane-modal lane-import-modal lane-export-deploy-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading !document.createElement div
 ; assign $heading { className lane-modal-title } { textContent 'Deploy Exported Changes' }
 ; to subtitle !document.createElement div
 ; assign $subtitle { className lane-modal-count } { textContent 'Review pending script changes and deploy connected target lanes' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading
 !title-wrap.appendChild $subtitle
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to err-el !document.createElement div
 ; assign $err-el { className lane-session-error } { hidden true } { textContent '' }
 ; to status-el !document.createElement div
 ; assign $status-el { className cc-status-banner } { hidden true } { textContent '' }

 ; to list-el !document.createElement div
 ; set lane-export-deploy-list list-el.className

 ; to footer !document.createElement div
 ; set lane-config-footer footer.className
 ; to close-footer-btn !document.createElement button
 ; assign $close-footer-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Close }
 ; to deploy-btn !document.createElement button
 ; assign $deploy-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Deploy Selected' }
 !footer.appendChild $close-footer-btn
 !footer.appendChild $deploy-btn

 !panel.appendChild $header
 !panel.appendChild $err-el
 !panel.appendChild $status-el
 !panel.appendChild $list-el
 !panel.appendChild $footer
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { err-el $err-el }
  { status-el $status-el }
  { list-el $list-el }
  { deploy-btn $deploy-btn }
  { close-btn $close-btn }
  { close-footer-btn $close-footer-btn }
  { is-open false }
  { is-deploying false }
  { items {} }
  { active-terms {} }
  { on-deployed null }
 ]

 ; to set-error (
  ; to { msg } $argv
  ; to clean [ match { $msg : ; add '' $msg } { true : '' } ]
  ; set $clean err-el.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] err-el.hidden
 )

 ; to set-banner (
  ; to { msg } $argv
  ; to clean [ match { $msg : ; add '' $msg } { true : '' } ]
  ; set $clean status-el.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] status-el.hidden
 )

 ; to clear-list (
  ; while { propertyIsGreaterThan 0 modal.active-terms.length } (
   ; to t !modal.active-terms.pop
   [ match { $t.disconnect : !t.disconnect } ]
  )
  ; while { propertyIsGreaterThan 0 modal.items.length } (
   ; to item !modal.items.pop
   [ match { $item.card-el.remove : !item.card-el.remove } ]
  )
  ; while { propertyIsGreaterThan 0 list-el.children.length } (
   ; to prev-len $list-el.children.length
   ; to idx ; subtract $prev-len 1
   ; to child [ get list-el.children $idx ]
   [ match { $child.remove : !child.remove } ]
   ; condition { propertyIs $prev-len list-el.children.length } : !list-el.children.pop
  )
 )

 ; to sync-deploy-btn (
  ; to count ; object { n 0 }
  ; each $modal.items (
   ; to { item } $argv
   ; condition { propertyIs true item.checkbox.checked } : ; set [ ; add $count.n 1 ] count.n
  )
  [ match
   { $modal.is-deploying (
    ; set true deploy-btn.disabled
    ; set 'Deploying...' deploy-btn.textContent
   ) }
   { [ propertyIsGreaterThan 0 count.n ] (
    ; set false deploy-btn.disabled
    ; set [ ; add 'Deploy Selected (' ; add $count.n ')' ] deploy-btn.textContent
   ) }
   { true (
    ; set true deploy-btn.disabled
    ; set 'Deploy Selected' deploy-btn.textContent
   ) }
  ]
 )

 ; to render-diff-box (
  ; to { diff-el status-info } $argv
  ; to diff $status-info.diff
  [ match
   { [ propertyIs not-deployed status-info.status ] (
    ; to msg !document.createElement div
    ; assign $msg { className cc-muted-meta } { textContent 'This lane has not been deployed yet. Configure & deploy in its Server tab first.' }
    !diff-el.appendChild $msg
   ) }
   { $status-info.unknownBaseline (
    ; to msg !document.createElement div
    ; assign $msg { className cc-muted-meta } { textContent 'No previous script baseline cached for this deployment yet. Deploying will capture the current script as baseline.' }
    !diff-el.appendChild $msg
    ; each $status-info.currentRecords (
     ; to { rec idx } $argv
     ; to row !document.createElement div
     ; assign $row { className 'lane-export-diff-line lane-export-diff-add' } { textContent [ ; add '+ L' ; add [ ; add $idx 1 ] ; add ': ' $rec.text ] }
     !diff-el.appendChild $row
    )
   ) }
   { [ propertyIs false status-info.hasChanges ] (
    ; to msg !document.createElement div
    ; assign $msg { className cc-muted-meta } { textContent 'Deployed script matches current lane source.' }
    !diff-el.appendChild $msg
   ) }
   { true (
    ; each $diff.changedLines (
     ; to { chg } $argv
     [ match
      { [ propertyIs modified chg.type ] (
       ; to del-row !document.createElement div
       ; assign $del-row { className 'lane-export-diff-line lane-export-diff-del' } { textContent [ ; add '- L' ; add $chg.lineNumber ; add ': ' $chg.before ] }
       ; to add-row !document.createElement div
       ; assign $add-row { className 'lane-export-diff-line lane-export-diff-add' } { textContent [ ; add '+ L' ; add $chg.lineNumber ; add ': ' $chg.after ] }
       !diff-el.appendChild $del-row
       !diff-el.appendChild $add-row
      ) }
      { [ propertyIs added chg.type ] (
       ; to add-row !document.createElement div
       ; assign $add-row { className 'lane-export-diff-line lane-export-diff-add' } { textContent [ ; add '+ L' ; add $chg.lineNumber ; add ': ' $chg.after ] }
       !diff-el.appendChild $add-row
      ) }
      { [ propertyIs removed chg.type ] (
       ; to del-row !document.createElement div
       ; assign $del-row { className 'lane-export-diff-line lane-export-diff-del' } { textContent [ ; add '- L' ; add $chg.lineNumber ; add ': ' $chg.before ] }
       !diff-el.appendChild $del-row
      ) }
     ]
    )
   ) }
  ]
 )

 ; to badge-for-status (
  ; to { status } $argv
  [ match
   { [ propertyIs up-to-date status ] : [ object { text 'Up to date' } { cls 'cc-badge cc-badge--ok' } ] }
   { [ propertyIs needs-deploy status ] : [ object { text 'Changes pending' } { cls 'cc-badge cc-badge--warn' } ] }
   { [ propertyIs unverified-baseline status ] : [ object { text 'Baseline uncached' } { cls 'cc-badge cc-badge--warn' } ] }
   { true : [ object { text 'Not deployed' } { cls cc-badge } ] }
  ]
 )

 ; to clear-el-children (
  ; to { el } $argv
  [ match
   { $el.replaceChildren : !el.replaceChildren }
   { true (
    ; while { propertyIsGreaterThan 0 el.children.length } (
     ; to prev-len $el.children.length
     ; to idx ; subtract $prev-len 1
     ; to child [ get el.children $idx ]
     [ match { $child.remove : !child.remove } ]
     ; condition { propertyIs $prev-len el.children.length } : !el.children.pop
    )
   ) }
  ]
 )

 ; to record-deployed-lane (
  -- Persists deployment metadata and deployed script baseline, then refreshes source lane status pills
  ; to { item bundle dep-at pub } $argv
  ; to dep $item.status-info.deployment
  [ match
   { $saveDeployedLaneScript (
    ; to snap-recs [ match
     { $bundle.lanes.0.records : $bundle.lanes.0.records }
     { true : $item.status-info.currentRecords }
    ]
    !saveDeployedLaneScript $data $item.lane-id $snap-recs $dep-at
   ) }
  ]
  [ match
   { $saveLaneDeployment (
    ; to next-dep ; object
    ; assign $next-dep $dep [ object
     { lastDeployedAt $dep-at }
     { lastSyncedAt $dep-at }
     { lastSyncLaneIds { $item.lane-id } }
     { publicUrl $pub }
    ]
    !saveLaneDeployment $data $next-dep
   ) }
  ]
  [ match
   { $item.diff-el (
    !clear-el-children $item.diff-el
    ; to ok-msg !document.createElement div
    ; assign $ok-msg { className cc-muted-meta } { textContent 'Deployed script matches current lane source.' }
    !item.diff-el.appendChild $ok-msg
   ) }
  ]
  ; set 'Deployed ✓' item.badge-el.textContent
  ; set 'cc-badge cc-badge--ok' item.badge-el.className
  ; set false item.checkbox.checked
  !sync-deploy-btn
  [ match
   { $lane-control.refresh-export-statuses : !lane-control.refresh-export-statuses $item.lane-id }
  ]
  [ match
   { $lane-control.servers-modal.refresh : !lane-control.servers-modal.refresh }
  ]
  [ match
   { $modal.on-deployed : !$modal.on-deployed $item.lane-id }
  ]
 )

 ; to open-item-terminal (
  ; to { item } $argv
  ; to dep $item.status-info.deployment
  ; to srv $item.server
  ; to has-term [ ternary $lane-control.terminal-modal true false ]
  [ match
   { [ propertyIs null dep ] : !set-error 'Lane has no saved deployment config.' }
   { [ propertyIs null srv ] : !set-error 'Deployment SSH server profile was not found.' }
   { [ propertyIs false has-term ] : !set-error 'Terminal modal is not available.' }
   { true (
    ; to bundle !collectLaneSyncBundle $data $item.lane-id [ object { includeImports $dep.includeImports } { openPackageIds $lane-control.open-package-ids } { win $window } ]
    ; to payload [ object
     { action deploy-lane }
     { server $srv }
     { deployment $dep }
     { syncBundle $bundle }
     { subtitle ; add $srv.user ; add '@' ; add $srv.host ; add ' · ' $dep.slug }
    ]
    ; to resp !startDeployTerminalSession $payload
    [ match
     { [ propertyIs true resp.ok ] (
      !lane-control.terminal-modal.open [ object
       { title $resp.title }
       { subtitle $payload.subtitle }
       { ws-path $resp.wsPath }
       { session-id $resp.sessionId }
       { on-sentinel (
        ; to { evt } $argv
        ; condition { propertyIs __CC_DEPLOY_OK__ evt.type } (
         ; to dep-at [ match { $evt.data.deployedAt : $evt.data.deployedAt } { true : !window.Date } ]
         ; to pub [ match { $evt.data.publicUrl : $evt.data.publicUrl } { true : $dep.publicUrl } ]
         !record-deployed-lane $item $bundle $dep-at $pub
        )
       ) }
      ]
     ) }
     { true : !set-error [ match { $resp.error : $resp.error } { true : 'Failed to start terminal session.' } ] }
    ]
   ) }
  ]
 )

 ; to deploy-single-item (
  -- Deploys one target lane sequentially via startDeployTerminalSession + mountTerminalView
  ; to { item } $argv
  ; to dep $item.status-info.deployment
  ; to srv $item.server
  ; to ok-state [ object { deployed false } { deployed-at null } { public-url '' } { exit-code null } ]
  ; to has-start-api [ ternary $startDeployTerminalSession true false ]
  [ match
   { [ propertyIs null dep ] (
    ; set 'No deployment config' item.badge-el.textContent
    ; set 'cc-badge cc-badge--err' item.badge-el.className
    false
   ) }
   { [ propertyIs null srv ] (
    ; set 'Missing SSH server' item.badge-el.textContent
    ; set 'cc-badge cc-badge--err' item.badge-el.className
    false
   ) }
   { [ propertyIs false has-start-api ] (
    ; set 'Deploy API missing' item.badge-el.textContent
    ; set 'cc-badge cc-badge--err' item.badge-el.className
    false
   ) }
   { true (
    ; set 'Deploying...' item.badge-el.textContent
    ; set 'cc-badge cc-badge--warn' item.badge-el.className
    ; set false item.term-wrap.hidden
    ; to bundle !collectLaneSyncBundle $data $item.lane-id [ object { includeImports $dep.includeImports } { openPackageIds $lane-control.open-package-ids } { win $window } ]
    ; to payload [ object
     { action deploy-lane }
     { server $srv }
     { deployment $dep }
     { syncBundle $bundle }
     { subtitle ; add $srv.user ; add '@' ; add $srv.host ; add ' · ' $dep.slug }
    ]
    ; to resp !startDeployTerminalSession $payload
    ; to has-ws [ ternary $window.WebSocket true false ]
    [ match
     { [ propertyIs false resp.ok ] (
      ; set 'Start failed' item.badge-el.textContent
      ; set 'cc-badge cc-badge--err' item.badge-el.className
      !set-error [ match { $resp.error : $resp.error } { true : 'Failed to start deployment.' } ]
      false
     ) }
     { [ propertyIs false has-ws ] (
      ; set 'No WebSocket' item.badge-el.textContent
      ; set 'cc-badge cc-badge--err' item.badge-el.className
      !set-error 'Browser WebSocket is unavailable for inline deploy streaming.'
      false
     ) }
     { true (
      ; to tracker !createIdleTracker
      ; to finish !tracker.begin
      ; to term !mountTerminalView $item.term-wrap [ object
       { wsUrl $resp.wsPath }
       { cols 88 }
       { rows 12 }
       { document $document }
       { window $window }
       { onSentinel (
        ; to { evt } $argv
        ; condition { propertyIs __CC_DEPLOY_OK__ evt.type } (
         ; set true ok-state.deployed
         ; set [ match { $evt.data.deployedAt : $evt.data.deployedAt } { true : '' } ] ok-state.deployed-at
         ; set [ match { $evt.data.publicUrl : $evt.data.publicUrl } { true : $dep.publicUrl } ] ok-state.public-url
        )
       ) }
       { onStatus (
        ; to { info } $argv
        ; condition { propertyIs exited info.status } (
         ; set $info.exitCode ok-state.exit-code
         !$finish true
        )
        ; condition { propertyIs error info.status } : !$finish false
       ) }
       { onClose (
        !$finish false
       ) }
      ]
      !modal.active-terms.push $term
      !tracker.whenIdle
      [ match
       { $ok-state.deployed (
        ; to dep-at [ match
         { [ propertyIs '' ok-state.deployed-at ] : !window.Date }
         { true : $ok-state.deployed-at }
        ]
        ; to pub [ match
         { [ propertyIs '' ok-state.public-url ] : $dep.publicUrl }
         { true : $ok-state.public-url }
        ]
        !record-deployed-lane $item $bundle $dep-at $pub
        true
       ) }
       { true (
        ; set 'Deploy failed' item.badge-el.textContent
        ; set 'cc-badge cc-badge--err' item.badge-el.className
        false
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to run-deploys (
  ; condition { propertyIs false modal.is-deploying } (
   !set-error ''
   !set-banner ''
   ; set true modal.is-deploying
   !sync-deploy-btn
   ; to ok-count ; object { n 0 }
   ; to fail-count ; object { n 0 }
   ; each $modal.items (
    ; to { item } $argv
    ; condition { propertyIs true item.checkbox.checked } (
     ; to did-ok ; try (
      !deploy-single-item $item
     ) (
      ; to { err } $argv
      ; set 'Deploy failed' item.badge-el.textContent
      ; set 'cc-badge cc-badge--err' item.badge-el.className
      ; to err-msg [ match { $err.message : $err.message } { $err : ; add '' $err } { true : 'Deployment failed.' } ]
      !set-error $err-msg
      false
     )
     [ match
      { $did-ok : ; set [ ; add $ok-count.n 1 ] ok-count.n }
      { true : ; set [ ; add $fail-count.n 1 ] fail-count.n }
     ]
    )
   )
   ; set false modal.is-deploying
   !sync-deploy-btn
   [ match
    { [ propertyIsGreaterThan 0 fail-count.n ] : !set-error [ ; add 'Deployed ' ; add $ok-count.n ; add ' lane(s); ' ; add $fail-count.n ' failed. Check logs or open Terminal.' ] }
    { [ propertyIsGreaterThan 0 ok-count.n ] : !set-banner [ ; add 'Deployed ' ; add $ok-count.n ' lane(s) successfully!' ] }
   ]
  )
 )

 ; to modal.close (
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   ; set false modal.is-deploying
   ; set null modal.on-deployed
   !clear-list
   !backdrop.remove
  )
 )

 ; to modal.open (
  -- Opens the Deploy Exported Changes modal for the given target list
  ; to { opts } $argv
  !set-error ''
  !set-banner ''
  !clear-list
  ; set false modal.is-deploying
  ; set $opts.on-deployed modal.on-deployed

  ; to unique-ids {}
  ; to seen ; object
  [ match
   { $opts.targets (
    ; each $opts.targets (
     ; to { t } $argv
     [ match
      { $t.laneId (
       ; to already [ get seen $t.laneId ]
       [ match
        { $already : null }
        { true (
         ; to seen $t.laneId true
         !unique-ids.push $t.laneId
        ) }
       ]
      ) }
     ]
    )
   ) }
  ]

  ; to servers [ match
   { $loadDeployServers : !loadDeployServers $data }
   { true : {} }
  ]
  ; to srv-by-id ; object
  ; each $servers (
   ; to { s } $argv
   ; to srv-by-id $s.id $s
  )

  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   !document.body.appendChild $backdrop
  )

  [ match
   { [ propertyIs 0 unique-ids.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-import-empty } { textContent 'No target lanes attached to this Export line.' }
    !list-el.appendChild $empty-el
   ) }
   { true (
    ; each $unique-ids (
     ; to { lid } $argv
     ; to status-info !getLaneDeployStatus $data $data $lid
     ; to title [ match
      { $lane-control.get-lane-title : !lane-control.get-lane-title $lid }
      { true : $lid }
     ]
     ; to srv [ match
      { $status-info.deployment.serverId : [ get srv-by-id $status-info.deployment.serverId ] }
      { true : null }
     ]
     ; to card-el !document.createElement div
     ; set lane-export-deploy-card card-el.className
     ; to card-hdr !document.createElement div
     ; set lane-export-deploy-card-hdr card-hdr.className

     ; to left-wrap !document.createElement label
     ; set lane-export-deploy-check-wrap left-wrap.className
     ; to checkbox !document.createElement input
     ; assign $checkbox { type checkbox } { className lane-export-deploy-check }
     ; to can-deploy [ match
      { [ propertyIs false status-info.deployed ] : false }
      { [ propertyIs null srv ] : false }
      { true : true }
     ]
     ; set [ ternary $can-deploy false true ] checkbox.disabled
     ; set [ ternary [ and { propertyIs true can-deploy } { propertyIs true status-info.hasChanges } ] true false ] checkbox.checked
     !checkbox.addEventListener change $sync-deploy-btn

     ; to name-el !document.createElement span
     ; assign $name-el { className lane-export-deploy-title } { textContent $title }
     !left-wrap.appendChild $checkbox
     !left-wrap.appendChild $name-el

     ; to right-wrap !document.createElement div
     ; set lane-export-deploy-actions right-wrap.className
     ; to badge-info !badge-for-status $status-info.status
     ; to badge-el !document.createElement span
     ; assign $badge-el { className $badge-info.cls } { textContent $badge-info.text }
     !right-wrap.appendChild $badge-el

     ; to item [ object
      { lane-id $lid }
      { title $title }
      { status-info $status-info }
      { server $srv }
      { card-el $card-el }
      { checkbox $checkbox }
      { badge-el $badge-el }
      { diff-el null }
      { term-wrap null }
     ]

     [ match
      { $can-deploy (
       ; to term-btn !document.createElement button
       ; assign $term-btn { type button } { className lane-modal-action } { textContent 'Open Terminal' }
       !term-btn.addEventListener click : !open-item-terminal $item
       !right-wrap.appendChild $term-btn
      ) }
     ]

     !card-hdr.appendChild $left-wrap
     !card-hdr.appendChild $right-wrap
     !card-el.appendChild $card-hdr

     [ match
      { $status-info.deployment.publicUrl (
       ; to url-el !document.createElement div
       ; assign $url-el { className cc-muted-meta } { textContent $status-info.deployment.publicUrl }
       !card-el.appendChild $url-el
      ) }
     ]

     ; to diff-el !document.createElement div
     ; set lane-export-diff-box diff-el.className
     ; set $diff-el item.diff-el
     !render-diff-box $diff-el $status-info
     !card-el.appendChild $diff-el

     ; to term-wrap !document.createElement div
     ; assign $term-wrap { className lane-export-deploy-term } { hidden true }
     ; set $term-wrap item.term-wrap
     !card-el.appendChild $term-wrap

     !list-el.appendChild $card-el
     !modal.items.push $item
    )
   ) }
  ]

  !sync-deploy-btn
  $modal
 )

 !deploy-btn.addEventListener click $run-deploys
 !close-btn.addEventListener click $modal.close
 !close-footer-btn.addEventListener click $modal.close
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 !window.addEventListener keydown (
  ; to { ev } $argv
  ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
 )

 $modal
)
$scope
