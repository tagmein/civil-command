-- file lane-server.fs
; to scope ; object
; to scope.mount (
 -- Mounts the per-lane HTTP API Tester (Mock & Live) and Remote SSH/Nginx/Civil-Memory Deployment panel
 ; to { lane container lane-control nb } $argv

 ; to root-el !document.createElement div
 ; set cc-server-panel root-el.className

 ; to default-slug [ match
  { $normalizeServiceSlug : !normalizeServiceSlug $lane.title $lane.id }
  { true : $lane.id }
 ]

 ; to view [ object
  { lane $lane }
  { container $container }
  { lane-control $lane-control }
  { nb $nb }
  { element $root-el }
  { tester-mode mock }
  { headers-open false }
  { resp-meta-open false }
  { servers {} }
  { server-option-els {} }
  { deployment null }
  { kv-ready false }
  { detected-handlers ; object { hasHandlers false } { methods {} } }
 ]

 -- Helper: safe child clearing for both real and mock DOM
 ; to clear-children (
  ; to { el } $argv
  [ match
   { $el.replaceChildren : !el.replaceChildren }
   { true (
    ; while { propertyIsGreaterThan 0 el.children.length } (
     ; to prev-len $el.children.length
     ; to idx ; subtract $prev-len 1
     ; to child [ get el.children $idx ]
     [ match
      { $child.remove : !child.remove }
     ]
     ; condition { propertyIs $prev-len el.children.length } : !el.children.pop
    )
    ; set '' el.textContent
   ) }
  ]
 )

 -- Section 1: HTTP Request Tester
 ; to tester-card !document.createElement div
 ; set cc-card tester-card.className

 ; to tester-hdr !document.createElement div
 ; set cc-card-header tester-hdr.className
 ; to tester-title !document.createElement div
 ; assign $tester-title { className cc-card-title } { textContent 'HTTP Request Tester' }
 ; to handlers-badge !document.createElement span
 ; assign $handlers-badge { className cc-badge } { textContent 'Expression mode (GET / → JSON)' }
 !tester-hdr.appendChild $tester-title
 !tester-hdr.appendChild $handlers-badge

 ; to mode-row !document.createElement div
 ; set cc-mode-switch mode-row.className
 ; to mock-mode-btn !document.createElement button
 ; assign $mock-mode-btn { type button } { className 'lane-tab lane-tab--active' } { textContent 'Mock (Local)' }
 ; to live-mode-btn !document.createElement button
 ; assign $live-mode-btn { type button } { className lane-tab } { textContent 'Live (Deployed)' }
 !mode-row.appendChild $mock-mode-btn
 !mode-row.appendChild $live-mode-btn

 ; to req-row !document.createElement div
 ; set cc-req-row req-row.className
 ; to method-select !document.createElement select
 ; set 'lane-input-type cc-method-select' method-select.className
 ; each { GET POST PUT PATCH DELETE HEAD OPTIONS } (
  ; to { m } $argv
  ; to opt !document.createElement option
  ; assign $opt { value $m } { textContent $m }
  !method-select.appendChild $opt
 )
 ; set GET method-select.value

 ; to path-input !document.createElement input
 ; assign $path-input { type text } { className 'lane-config-input cc-path-input' } { value '/' } { placeholder '/path?query=1' } { spellcheck false } { autocomplete off }

 ; to send-btn !document.createElement button
 ; assign $send-btn { type button } { className 'lane-modal-action lane-config-btn--save cc-send-btn' } { textContent Send }
 !req-row.appendChild $method-select
 !req-row.appendChild $path-input
 !req-row.appendChild $send-btn

 ; to extra-toggle !document.createElement button
 ; assign $extra-toggle { type button } { className lane-session-advanced-toggle } { textContent '▸ Headers & Body' }
 ; to extra-box !document.createElement div
 ; assign $extra-box { className cc-extra-box } { hidden true }

 ; to hdrs-lbl !document.createElement label
 ; assign $hdrs-lbl { className lane-config-label } { textContent 'Request Headers (JSON)' }
 ; to hdrs-input !document.createElement textarea
 ; assign $hdrs-input { className cc-textarea } { rows 2 } { value '{}' } { placeholder '{"Authorization": "Bearer ..."}' } { spellcheck false }
 ; to body-lbl !document.createElement label
 ; assign $body-lbl { className lane-config-label } { textContent 'Request Body (JSON or text)' }
 ; to body-input !document.createElement textarea
 ; assign $body-input { className cc-textarea } { rows 3 } { value '' } { placeholder '{"hello": "world"}' } { spellcheck false }
 !extra-box.appendChild $hdrs-lbl
 !extra-box.appendChild $hdrs-input
 !extra-box.appendChild $body-lbl
 !extra-box.appendChild $body-input

 ; to tester-err !document.createElement div
 ; assign $tester-err { className lane-session-error } { textContent '' } { hidden true }

 ; to resp-box !document.createElement div
 ; assign $resp-box { className cc-resp-box } { hidden true }
 ; to resp-meta !document.createElement div
 ; set cc-resp-meta resp-meta.className
 ; to resp-status !document.createElement span
 ; assign $resp-status { className cc-badge } { textContent '' }
 ; to resp-time !document.createElement span
 ; assign $resp-time { className cc-muted-meta } { textContent '' }
 ; to resp-mode !document.createElement span
 ; assign $resp-mode { className cc-muted-meta } { textContent '' }
 !resp-meta.appendChild $resp-status
 !resp-meta.appendChild $resp-time
 !resp-meta.appendChild $resp-mode

 ; to resp-pre !document.createElement pre
 ; assign $resp-pre { className cc-resp-pre } { textContent '' }

 ; to resp-details-toggle !document.createElement button
 ; assign $resp-details-toggle { type button } { className lane-session-advanced-toggle } { textContent '▸ Response Headers & Logs' }
 ; to resp-details-box !document.createElement pre
 ; assign $resp-details-box { className cc-resp-details } { hidden true } { textContent '' }

 !resp-box.appendChild $resp-meta
 !resp-box.appendChild $resp-pre
 !resp-box.appendChild $resp-details-toggle
 !resp-box.appendChild $resp-details-box

 !tester-card.appendChild $tester-hdr
 !tester-card.appendChild $mode-row
 !tester-card.appendChild $req-row
 !tester-card.appendChild $extra-toggle
 !tester-card.appendChild $extra-box
 !tester-card.appendChild $tester-err
 !tester-card.appendChild $resp-box

 -- Section 2: Deployment & Civil-Memory Prerequisites
 ; to deploy-card !document.createElement div
 ; set cc-card deploy-card.className

 ; to deploy-hdr !document.createElement div
 ; set cc-card-header deploy-hdr.className
 ; to deploy-title !document.createElement div
 ; assign $deploy-title { className cc-card-title } { textContent 'Remote Deployment' }
 ; to servers-btn !document.createElement button
 ; assign $servers-btn { type button } { className lane-modal-action } { textContent 'Servers…' }
 !deploy-hdr.appendChild $deploy-title
 !deploy-hdr.appendChild $servers-btn

 ; to deploy-err !document.createElement div
 ; assign $deploy-err { className lane-session-error } { textContent '' } { hidden true }
 ; to deploy-status !document.createElement div
 ; assign $deploy-status { className cc-status-banner } { textContent '' } { hidden true }

 ; to srv-field !document.createElement div
 ; set lane-config-field srv-field.className
 ; to srv-lbl !document.createElement label
 ; assign $srv-lbl { className lane-config-label } { textContent 'Target SSH Server' }
 ; to srv-select !document.createElement select
 ; set 'lane-input-type lane-config-input lane-config-select' srv-select.className
 !srv-field.appendChild $srv-lbl
 !srv-field.appendChild $srv-select

 -- Civil-Memory Prerequisite Box
 ; to kv-card !document.createElement div
 ; set cc-subcard kv-card.className
 ; to kv-hdr !document.createElement div
 ; set cc-card-header kv-hdr.className
 ; to kv-title !document.createElement div
 ; assign $kv-title { className cc-subcard-title } { textContent '1. civil-memory KV Prerequisite' }
 ; to kv-badge !document.createElement span
 ; assign $kv-badge { className 'cc-badge cc-badge--warn' } { textContent 'KV Not Ready' }
 !kv-hdr.appendChild $kv-title
 !kv-hdr.appendChild $kv-badge

 ; to kv-url-lbl !document.createElement label
 ; assign $kv-url-lbl { className lane-config-label } { textContent 'civil-memory URL' }
 ; to kv-url-input !document.createElement input
 ; assign $kv-url-input { type text } { className lane-config-input } { value '' } { placeholder 'http://127.0.0.1:3333 or https://kv.example.com' } { spellcheck false } { autocomplete off }

 ; to kv-base-lbl !document.createElement label
 ; assign $kv-base-lbl { className lane-config-label } { textContent 'Disk Mode Data Path (modeOptions.disk.basePath)' }
 ; to kv-base-input !document.createElement input
 ; assign $kv-base-input { type text } { className lane-config-input } { value ; add '/opt/civil-command/' ; add $default-slug '/data' } { placeholder '/opt/civil-command/my-lane/data' } { spellcheck false } { autocomplete off }

 ; to imports-lbl !document.createElement label
 ; set cc-checkbox-label imports-lbl.className
 ; to imports-check !document.createElement input
 ; assign $imports-check { type checkbox }
 ; to imports-txt !document.createElement span
 ; assign $imports-txt { textContent 'Include imported lanes (optional; otherwise importLane returns undefined)' }
 !imports-lbl.appendChild $imports-check
 !imports-lbl.appendChild $imports-txt

 ; to kv-btn-row !document.createElement div
 ; set cc-btn-row kv-btn-row.className
 ; to verify-kv-btn !document.createElement button
 ; assign $verify-kv-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent 'Verify KV' }
 ; to install-cm-btn !document.createElement button
 ; assign $install-cm-btn { type button } { className lane-modal-action } { textContent 'Install civil-memory…' }
 ; to sync-kv-btn !document.createElement button
 ; assign $sync-kv-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Sync Lane to KV' } { disabled true }
 !kv-btn-row.appendChild $verify-kv-btn
 !kv-btn-row.appendChild $install-cm-btn
 !kv-btn-row.appendChild $sync-kv-btn

 ; to sync-meta-el !document.createElement div
 ; assign $sync-meta-el { className cc-muted-meta } { textContent 'Verify civil-memory before syncing or deploying.' }

 !kv-card.appendChild $kv-hdr
 !kv-card.appendChild $kv-url-lbl
 !kv-card.appendChild $kv-url-input
 !kv-card.appendChild $kv-base-lbl
 !kv-card.appendChild $kv-base-input
 !kv-card.appendChild $imports-lbl
 !kv-card.appendChild $kv-btn-row
 !kv-card.appendChild $sync-meta-el

 -- Service & Nginx Route Config Box
 ; to route-card !document.createElement div
 ; set cc-subcard route-card.className
 ; to route-title !document.createElement div
 ; assign $route-title { className cc-subcard-title } { textContent '2. Service & Nginx Routing' }

 ; to slug-lbl !document.createElement label
 ; assign $slug-lbl { className lane-config-label } { textContent 'Service Slug (/opt/civil-command/<slug>)' }
 ; to slug-input !document.createElement input
 ; assign $slug-input { type text } { className lane-config-input } { value $default-slug } { placeholder 'my-lane-api' } { spellcheck false } { autocomplete off }

 ; to port-lbl !document.createElement label
 ; assign $port-lbl { className lane-config-label } { textContent 'Localhost Service Port' }
 ; to port-input !document.createElement input
 ; assign $port-input { type text } { className lane-config-input } { value '4100' } { placeholder '4100' } { spellcheck false } { autocomplete off }

 ; to rmode-lbl !document.createElement label
 ; assign $rmode-lbl { className lane-config-label } { textContent 'Nginx Route Mode' }
 ; to rmode-select !document.createElement select
 ; set 'lane-input-type lane-config-input lane-config-select' rmode-select.className
 ; to opt-sub !document.createElement option
 ; assign $opt-sub { value subpath } { textContent 'Subpath on common Nginx domain' }
 ; to opt-dom !document.createElement option
 ; assign $opt-dom { value domain } { textContent 'Dedicated domain / subdomain' }
 !rmode-select.appendChild $opt-sub
 !rmode-select.appendChild $opt-dom

 ; to domain-lbl !document.createElement label
 ; assign $domain-lbl { className lane-config-label } { textContent 'Domain / Subdomain' }
 ; to domain-input !document.createElement input
 ; assign $domain-input { type text } { className lane-config-input } { value '' } { placeholder 'api.example.com' } { spellcheck false } { autocomplete off }

 ; to subpath-wrap !document.createElement div
 ; set lane-config-field subpath-wrap.className
 ; to subpath-lbl !document.createElement label
 ; assign $subpath-lbl { className lane-config-label } { textContent 'URL Subpath' }
 ; to subpath-input !document.createElement input
 ; assign $subpath-input { type text } { className lane-config-input } { value ; add '/' $default-slug } { placeholder '/my-api' } { spellcheck false } { autocomplete off }
 !subpath-wrap.appendChild $subpath-lbl
 !subpath-wrap.appendChild $subpath-input

 ; to le-lbl !document.createElement label
 ; set cc-checkbox-label le-lbl.className
 ; to le-check !document.createElement input
 ; assign $le-check { type checkbox }
 ; to le-txt !document.createElement span
 ; assign $le-txt { textContent 'Auto-run Let\'s Encrypt (certbot --nginx)' }
 !le-lbl.appendChild $le-check
 !le-lbl.appendChild $le-txt

 ; to le-email-wrap !document.createElement div
 ; assign $le-email-wrap { className lane-config-field } { hidden true }
 ; to le-email-lbl !document.createElement label
 ; assign $le-email-lbl { className lane-config-label } { textContent 'Let\'s Encrypt Email (optional)' }
 ; to le-email-input !document.createElement input
 ; assign $le-email-input { type text } { className lane-config-input } { value '' } { placeholder 'admin@example.com (blank = interactive prompt)' } { spellcheck false } { autocomplete off }
 !le-email-wrap.appendChild $le-email-lbl
 !le-email-wrap.appendChild $le-email-input

 ; to cors-lbl !document.createElement label
 ; set cc-checkbox-label cors-lbl.className
 ; to cors-check !document.createElement input
 ; assign $cors-check { type checkbox } { checked true }
 ; to cors-txt !document.createElement span
 ; assign $cors-txt { textContent 'Enable CORS (*)' }
 !cors-lbl.appendChild $cors-check
 !cors-lbl.appendChild $cors-txt

 ; to public-url-preview !document.createElement div
 ; assign $public-url-preview { className cc-public-url } { textContent 'Public URL: (enter domain)' }

 ; to deploy-btn-row !document.createElement div
 ; set cc-btn-row deploy-btn-row.className
 ; to save-cfg-btn !document.createElement button
 ; assign $save-cfg-btn { type button } { className lane-modal-action } { textContent 'Save Config' }
 ; to deploy-btn !document.createElement button
 ; assign $deploy-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Sync & Deploy' } { disabled true }
 !deploy-btn-row.appendChild $save-cfg-btn
 !deploy-btn-row.appendChild $deploy-btn

 ; to lifecycle-row !document.createElement div
 ; set cc-btn-row lifecycle-row.className
 ; to start-btn !document.createElement button
 ; assign $start-btn { type button } { className lane-modal-action } { textContent Start }
 ; to restart-btn !document.createElement button
 ; assign $restart-btn { type button } { className lane-modal-action } { textContent Restart }
 ; to stop-btn !document.createElement button
 ; assign $stop-btn { type button } { className lane-modal-action } { textContent Stop }
 ; to logs-btn !document.createElement button
 ; assign $logs-btn { type button } { className lane-modal-action } { textContent Logs }
 ; to status-btn !document.createElement button
 ; assign $status-btn { type button } { className lane-modal-action } { textContent Status }
 ; to undeploy-btn !document.createElement button
 ; assign $undeploy-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Undeploy }
 !lifecycle-row.appendChild $start-btn
 !lifecycle-row.appendChild $restart-btn
 !lifecycle-row.appendChild $stop-btn
 !lifecycle-row.appendChild $logs-btn
 !lifecycle-row.appendChild $status-btn
 !lifecycle-row.appendChild $undeploy-btn

 !route-card.appendChild $route-title
 !route-card.appendChild $slug-lbl
 !route-card.appendChild $slug-input
 !route-card.appendChild $port-lbl
 !route-card.appendChild $port-input
 !route-card.appendChild $rmode-lbl
 !route-card.appendChild $rmode-select
 !route-card.appendChild $domain-lbl
 !route-card.appendChild $domain-input
 !route-card.appendChild $subpath-wrap
 !route-card.appendChild $le-lbl
 !route-card.appendChild $le-email-wrap
 !route-card.appendChild $cors-lbl
 !route-card.appendChild $public-url-preview
 !route-card.appendChild $deploy-btn-row
 !route-card.appendChild $lifecycle-row

 !deploy-card.appendChild $deploy-hdr
 !deploy-card.appendChild $deploy-err
 !deploy-card.appendChild $deploy-status
 !deploy-card.appendChild $srv-field
 !deploy-card.appendChild $kv-card
 !deploy-card.appendChild $route-card

 !root-el.appendChild $tester-card
 !root-el.appendChild $deploy-card
 !container.appendChild $root-el

 ; assign $view [ object
  { element $root-el }
  { handlers-badge $handlers-badge }
  { mock-mode-btn $mock-mode-btn }
  { live-mode-btn $live-mode-btn }
  { method-select $method-select }
  { path-input $path-input }
  { send-btn $send-btn }
  { extra-toggle $extra-toggle }
  { extra-box $extra-box }
  { hdrs-input $hdrs-input }
  { body-input $body-input }
  { tester-err $tester-err }
  { resp-box $resp-box }
  { resp-status $resp-status }
  { resp-time $resp-time }
  { resp-mode $resp-mode }
  { resp-pre $resp-pre }
  { resp-details-toggle $resp-details-toggle }
  { resp-details-box $resp-details-box }
  { deploy-err $deploy-err }
  { deploy-status $deploy-status }
  { servers-btn $servers-btn }
  { srv-select $srv-select }
  { kv-badge $kv-badge }
  { kv-url-input $kv-url-input }
  { kv-base-input $kv-base-input }
  { imports-check $imports-check }
  { verify-kv-btn $verify-kv-btn }
  { install-cm-btn $install-cm-btn }
  { sync-kv-btn $sync-kv-btn }
  { sync-meta-el $sync-meta-el }
  { slug-input $slug-input }
  { port-input $port-input }
  { rmode-select $rmode-select }
  { domain-input $domain-input }
  { subpath-wrap $subpath-wrap }
  { subpath-input $subpath-input }
  { le-check $le-check }
  { le-email-wrap $le-email-wrap }
  { le-email-input $le-email-input }
  { cors-check $cors-check }
  { public-url-preview $public-url-preview }
  { save-cfg-btn $save-cfg-btn }
  { deploy-btn $deploy-btn }
  { start-btn $start-btn }
  { restart-btn $restart-btn }
  { stop-btn $stop-btn }
  { logs-btn $logs-btn }
  { status-btn $status-btn }
  { undeploy-btn $undeploy-btn }
 ]

 ; to set-tester-error (
  ; to { msg } $argv
  ; to clean [ match { $msg : ; add '' $msg } { true : '' } ]
  ; set $clean tester-err.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] tester-err.hidden
 )

 ; to set-deploy-error (
  ; to { msg } $argv
  ; to clean [ match { $msg : ; add '' $msg } { true : '' } ]
  ; set $clean deploy-err.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] deploy-err.hidden
 )

 ; to set-deploy-status (
  ; to { msg } $argv
  ; to clean [ match { $msg : ; add '' $msg } { true : '' } ]
  ; set $clean deploy-status.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] deploy-status.hidden
 )

 ; to selected-server (
  ; to target-id $srv-select.value
  ; to found ; object { val null }
  ; each $view.servers (
   ; to { s } $argv
   ; condition { propertyIs $target-id s.id } : ; set $s found.val
  )
  $found.val
 )

 ; to compute-public-url (
  ; to rmode $rmode-select.value
  ; to dom !domain-input.value.trim
  ; to sub !subpath-input.value.trim
  ; to https $le-check.checked
  [ match
   { $buildPublicEndpointUrl : !buildPublicEndpointUrl [ object { routeMode $rmode } { domain $dom } { subpath $sub } { https $https } ] }
   { true : '' }
  ]
 )

 ; to sync-route-ui (
  ; to is-sub [ propertyIs subpath rmode-select.value ]
  ; set [ ternary $is-sub false true ] subpath-wrap.hidden
  ; set [ ternary $le-check.checked false true ] le-email-wrap.hidden
  ; to pub !compute-public-url
  ; to label [ match
   { $pub : ; add 'Public URL: ' $pub }
   { true : 'Public URL: (enter domain)' }
  ]
  ; set $label public-url-preview.textContent
 )

 ; to sync-gate-ui (
  ; to ready $view.kv-ready
  ; to srv !selected-server
  ; to has-srv [ match { $srv : true } { true : false } ]
  ; set [ ternary $ready 'KV Ready ✓' 'KV Not Ready' ] kv-badge.textContent
  ; set [ ternary $ready 'cc-badge cc-badge--ok' 'cc-badge cc-badge--warn' ] kv-badge.className
  ; set [ ternary $ready false true ] sync-kv-btn.disabled
  ; to can-deploy [ match
   { [ propertyIs false ready ] : false }
   { [ propertyIs false has-srv ] : false }
   { true : true }
  ]
  ; set [ ternary $can-deploy false true ] deploy-btn.disabled
  ; set [ ternary $has-srv false true ] install-cm-btn.disabled
  ; set [ ternary $has-srv false true ] start-btn.disabled
  ; set [ ternary $has-srv false true ] restart-btn.disabled
  ; set [ ternary $has-srv false true ] stop-btn.disabled
  ; set [ ternary $has-srv false true ] logs-btn.disabled
  ; set [ ternary $has-srv false true ] status-btn.disabled
  ; set [ ternary $has-srv false true ] undeploy-btn.disabled
 )

 ; to safe-port (
  ; to raw !port-input.value.trim
  ; to parsed [ match
   { $window.Number : !window.Number $raw }
   { true : 4100 }
  ]
  [ match
   { [ propertyIs '' raw ] : 4100 }
   { [ propertyIsGreaterThan 0 parsed ] : $parsed }
   { true : 4100 }
  ]
 )

 ; to build-deployment-record (
  ; to { extras } $argv
  ; to raw-slug !slug-input.value.trim
  ; to clean-slug [ match
   { $normalizeServiceSlug : !normalizeServiceSlug $raw-slug $default-slug }
   { $raw-slug : $raw-slug }
   { true : $default-slug }
  ]
  ; to clean-port !safe-port
  ; to pub !compute-public-url
  ; to prev $view.deployment
  ; to base [ object
   { laneId $lane.id }
   { title $lane.title }
   { serverId $srv-select.value }
   { slug $clean-slug }
   { port $clean-port }
   { routeMode $rmode-select.value }
   { domain !domain-input.value.trim }
   { subpath !subpath-input.value.trim }
   { enableLetsEncrypt $le-check.checked }
   { letsEncryptEmail !le-email-input.value.trim }
   { cors $cors-check.checked }
   { civilMemoryUrl !kv-url-input.value.trim }
   { dataBasePath !kv-base-input.value.trim }
   { includeImports $imports-check.checked }
   { kvReady $view.kv-ready }
   { publicUrl $pub }
   { lastSyncedAt [ match { $prev.lastSyncedAt : $prev.lastSyncedAt } { true : null } ] }
   { lastDeployedAt [ match { $prev.lastDeployedAt : $prev.lastDeployedAt } { true : null } ] }
   { lastSyncLaneIds [ match { $prev.lastSyncLaneIds : $prev.lastSyncLaneIds } { true : {} } ] }
  ]
  [ match
   { $extras : ; assign $base $extras }
  ]
  $base
 )

 ; to persist-deployment (
  ; to { extras } $argv
  ; to rec !build-deployment-record $extras
  [ match
   { $saveLaneDeployment (
    ; to saved !saveLaneDeployment $data $rec
    ; set $saved view.deployment
    $saved
   ) }
   { true (
    ; set $rec view.deployment
    $rec
   ) }
  ]
 )

 ; to view.refresh-handlers (
  -- Updates detected HTTP handler badge from the most recent lane execution state
  ; to { outcome } $argv
  ; to st [ match
   { $outcome.state : $outcome.state }
   { $nb.state : $nb.state }
   { true : null }
  ]
  [ match
   { $detectLaneHandlers (
    ; to info !detectLaneHandlers $st
    ; set $info view.detected-handlers
    [ match
     { $info.hasHandlers (
      ; to joined !info.methods.join ', '
      ; set [ ; add 'Handlers: ' $joined ] handlers-badge.textContent
      ; set 'cc-badge cc-badge--ok' handlers-badge.className
     ) }
     { true (
      ; set 'Expression mode (GET / → JSON)' handlers-badge.textContent
      ; set cc-badge handlers-badge.className
     ) }
    ]
   ) }
  ]
 )

 ; to render-response (
  ; to { resp } $argv
  ; set false resp-box.hidden
  ; to code [ match { $resp.status : $resp.status } { true : 200 } ]
  ; set [ ; add '' $code ] resp-status.textContent
  ; to status-cls [ match
   { [ propertyIsLessThan 300 code ] : 'cc-badge cc-badge--ok' }
   { [ propertyIsLessThan 500 code ] : 'cc-badge cc-badge--warn' }
   { true : 'cc-badge cc-badge--err' }
  ]
  ; set $status-cls resp-status.className
  ; to dur [ match { $resp.durationMs : $resp.durationMs } { true : 0 } ]
  ; set [ ; add $dur ' ms' ] resp-time.textContent
  ; to mode-lbl [ match
   { $resp.handlerName : ; add 'handler · ' $resp.handlerName }
   { $resp.mode : $resp.mode }
   { true : live }
  ]
  ; set $mode-lbl resp-mode.textContent

  ; to raw-text [ match
   { [ propertyIs null resp.bodyText ] : '' }
   { [ propertyIs undefined resp.bodyText ] : '' }
   { true : ; add '' $resp.bodyText }
  ]
  ; to formatted ; try (
   ; to trimmed !raw-text.trim
   [ match
    { [ propertyIs '' trimmed ] : '(empty body)' }
    { true (
     ; to parsed !window.JSON.parse $trimmed
     !window.JSON.stringify $parsed null 2
    ) }
   ]
  ) : $raw-text
  ; set $formatted resp-pre.textContent

  ; to details-obj [ object
   { headers [ match { $resp.headers : $resp.headers } { true : ; object } ] }
   { logs [ match { $resp.logs : $resp.logs } { true : {} } ] }
  ]
  ; to details-str ; try (
   !window.JSON.stringify $details-obj null 2
  ) : ''
  ; set $details-str resp-details-box.textContent
 )

 ; to run-tester-request (
  !set-tester-error ''
  ; to req-method $method-select.value
  ; to trimmed-path !path-input.value.trim
  ; to req-path [ match
   { $trimmed-path : $trimmed-path }
   { true : '/' }
  ]
  ; to parsed-headers ; try (
   ; to htxt !hdrs-input.value.trim
   [ match
    { [ propertyIs '' htxt ] : ; object }
    { true : !window.JSON.parse $htxt }
   ]
  ) : null

  [ match
   { [ propertyIs null parsed-headers ] : !set-tester-error 'Request Headers must be valid JSON object.' }
   { [ propertyIs mock view.tester-mode ] (
    [ match
     { $simulateLaneRequest (
      ; to import-fn (
       ; to { target-id ...path } $argv
       [ match
        { [ propertyIs '' target-id ] : undefined }
        { [ propertyIs undefined target-id ] : undefined }
        { $lane-control.get-lane-final-state (
         ; to res !lane-control.get-lane-final-state $target-id $lane.id
         !resolveImportValue $res $path
        ) }
        { true : undefined }
       ]
      )
      ; to sim-opts [ object
       { lines $nb.lines }
       { inputs $nb.inputs }
       { tables $nb.tables }
       { laneId $lane.id }
       { laneData $lane.data }
       { importLaneFn $import-fn }
       { cors $cors-check.checked }
       { forceFresh true }
       { req [ object
        { method $req-method }
        { path $req-path }
        { headers $parsed-headers }
        { rawBody $body-input.value }
       ] }
      ]
      ; to resp !simulateLaneRequest $sim-opts
      !render-response $resp
     ) }
     { true : !set-tester-error 'Mock simulator is not available.' }
    ]
   ) }
   { true (
    ; to base-url !compute-public-url
    [ match
     { [ propertyIs '' base-url ] : !set-tester-error 'Configure a domain (or deploy first) to send live requests.' }
     { $proxyDeployRequest (
      ; to clean-path [ match
       { [ !req-path.startsWith '/' ] : $req-path }
       { true : ; add '/' $req-path }
      ]
      ; to full-url ; add $base-url $clean-path
      ; to proxy-res !proxyDeployRequest [ object
       { url $full-url }
       { method $req-method }
       { headers $parsed-headers }
       { body $body-input.value }
      ]
      [ match
       { [ propertyIs true proxy-res.ok ] : !render-response $proxy-res }
       { true : !set-tester-error [ match { $proxy-res.error : $proxy-res.error } { true : 'Live request failed' } ] }
      ]
     ) }
     { true : !set-tester-error 'Live proxy API is not available.' }
    ]
   ) }
  ]
 )

 ; to is-ssh-local-kv (
  ; to { srv cm-url } $argv
  [ match
   { [ propertyIs external srv.civilMemoryMode ] : false }
   { [ !cm-url.includes '127.0.0.1' ] : true }
   { [ !cm-url.includes localhost ] : true }
   { [ !cm-url.includes '::1' ] : true }
   { true : false }
  ]
 )

 ; to launch-terminal-action (
  ; to { payload on-sent } $argv
  !set-deploy-error ''
  [ match
   { $startDeployTerminalSession (
    ; to resp !startDeployTerminalSession $payload
    [ match
     { [ propertyIs false resp.ok ] : !set-deploy-error [ match { $resp.error : $resp.error } { true : 'Failed to start terminal session' } ] }
     { $lane-control.terminal-modal.open (
      ; to open-opts [ object
       { title $resp.title }
       { subtitle $payload.subtitle }
       { wsPath $resp.wsPath }
       { sessionId $resp.sessionId }
       { onSentinel $on-sent }
      ]
      !lane-control.terminal-modal.open $open-opts
     ) }
     { true : !set-deploy-error 'Terminal modal is not available.' }
    ]
   ) }
   { true : !set-deploy-error 'Deploy terminal API is not available.' }
  ]
 )

 ; to collect-bundle (
  ; to inc-imports $imports-check.checked
  [ match
   { $lane-control.collect-lane-bundle : !lane-control.collect-lane-bundle $lane.id $inc-imports }
   { $collectLaneSyncBundle : !collectLaneSyncBundle $data $lane.id [ object { includeImports $inc-imports } { openPackageIds $lane-control.open-package-ids } { win $window } ] }
   { true : null }
  ]
 )

 ; to verify-kv-flow (
  !set-deploy-error ''
  !set-deploy-status ''
  ; to srv !selected-server
  ; to cm-url !kv-url-input.value.trim
  ; to base-path !kv-base-input.value.trim
  [ match
   { [ propertyIs '' cm-url ] : !set-deploy-error 'Enter a civil-memory URL or install civil-memory on the server first.' }
   { true (
    ; to via-ssh [ match
     { $srv : !is-ssh-local-kv $srv $cm-url }
     { true : false }
    ]
    [ match
     { $via-ssh (
      ; to payload [ object
       { action test-kv }
       { server $srv }
       { url $cm-url }
       { basePath $base-path }
       { subtitle ; add $srv.user ; add '@' $srv.host }
      ]
      !launch-terminal-action $payload (
       ; to { evt } $argv
       ; condition { propertyIs __CC_KV_READY__ evt.type } (
        ; set true view.kv-ready
        !sync-gate-ui
        !persist-deployment [ object { kvReady true } ]
        !set-deploy-status 'civil-memory KV verified ready!'
       )
      )
     ) }
     { $testRemoteCivilMemory (
      !set-deploy-status 'Verifying external civil-memory KV...'
      ; to res !testRemoteCivilMemory [ object { url $cm-url } { basePath $base-path } ]
      [ match
       { [ propertyIs true res.ok ] (
        ; set true view.kv-ready
        !sync-gate-ui
        !persist-deployment [ object { kvReady true } ]
        !set-deploy-status 'civil-memory KV verified ready!'
       ) }
       { true (
        ; set false view.kv-ready
        !sync-gate-ui
        !set-deploy-status ''
        !set-deploy-error [ match { $res.error : $res.error } { true : 'civil-memory verification failed.' } ]
       ) }
      ]
     ) }
     { true : !set-deploy-error 'KV verification API is not available.' }
    ]
   ) }
  ]
 )

 ; to install-cm-flow (
  !set-deploy-error ''
  ; to srv !selected-server
  [ match
   { [ propertyIs null srv ] : !set-deploy-error 'Select a target SSH server first.' }
   { true (
    ; to payload [ object
     { action install-civil-memory }
     { server $srv }
     { subtitle ; add 'Installing civil-memory on ' $srv.host }
    ]
    !launch-terminal-action $payload (
     ; to { evt } $argv
     ; condition { propertyIs __CC_CIVIL_MEMORY_READY__ evt.type } (
      ; to next-url [ match
       { $evt.data.exposedUrl : $evt.data.exposedUrl }
       { $evt.data.url : $evt.data.url }
       { true : 'http://127.0.0.1:3333' }
      ]
      ; set $next-url kv-url-input.value
      ; to trimmed-slug !slug-input.value.trim
      ; to slug-val [ match { $trimmed-slug : $trimmed-slug } { true : $default-slug } ]
      ; to next-root [ match { $evt.data.defaultDataRoot : $evt.data.defaultDataRoot } { true : '/opt/civil-command/data' } ]
      ; to cur-base !kv-base-input.value.trim
      [ match
       { [ propertyIs '' cur-base ] : ; set [ ; add $next-root ; add '/' $slug-val ] kv-base-input.value }
      ]
      ; to updated-srv ; object
      ; assign $updated-srv $srv [ object { civilMemoryMode local } { civilMemoryUrl $next-url } { civilMemoryDataRoot $next-root } { civilMemoryVerified true } ]
      [ match
       { $saveDeployServer : !saveDeployServer $data $updated-srv }
      ]
      ; set true view.kv-ready
      !sync-gate-ui
      !persist-deployment [ object { kvReady true } { civilMemoryUrl $next-url } ]
      !set-deploy-status ; add 'civil-memory installed & ready (' ; add $next-url ')'
     )
    )
   ) }
  ]
 )

 ; to sync-kv-flow (
  !set-deploy-error ''
  !set-deploy-status ''
  [ match
   { [ propertyIs false view.kv-ready ] : !set-deploy-error 'Verify civil-memory KV ready before syncing.' }
   { true (
    ; to srv !selected-server
    ; to cm-url !kv-url-input.value.trim
    ; to base-path !kv-base-input.value.trim
    ; to bundle !collect-bundle
    [ match
     { [ propertyIs null bundle ] : !set-deploy-error 'Could not collect lane sync bundle.' }
     { true (
      ; to via-ssh [ match
       { $srv : !is-ssh-local-kv $srv $cm-url }
       { true : false }
      ]
      [ match
       { $via-ssh (
        ; to payload [ object
         { action sync-lane }
         { server $srv }
         { url $cm-url }
         { basePath $base-path }
         { bundle $bundle }
         { subtitle ; add $srv.user ; add '@' $srv.host }
        ]
        !launch-terminal-action $payload (
         ; to { evt } $argv
         ; condition { propertyIs __CC_SYNC_OK__ evt.type } (
          ; to synced-at [ match { $evt.data.syncedAt : $evt.data.syncedAt } { true : !window.Date } ]
          ; to synced-ids [ match { $evt.data.laneIds : $evt.data.laneIds } { true : { $lane.id } } ]
          !persist-deployment [ object { lastSyncedAt $synced-at } { lastSyncLaneIds $synced-ids } ]
          ; set [ ; add 'Synced ' ; add $synced-ids.length ' lane(s) to civil-memory.' ] sync-meta-el.textContent
          !set-deploy-status 'Lane synced to civil-memory!'
         )
        )
       ) }
       { $syncLaneToRemoteCivilMemory (
        !set-deploy-status 'Syncing lane bundle to external civil-memory...'
        ; to res !syncLaneToRemoteCivilMemory [ object { url $cm-url } { basePath $base-path } { bundle $bundle } ]
        [ match
         { [ propertyIs true res.ok ] (
          ; to synced-at [ match { $res.syncedAt : $res.syncedAt } { true : !window.Date } ]
          ; to synced-ids [ match { $res.laneIds : $res.laneIds } { true : { $lane.id } } ]
          !persist-deployment [ object { lastSyncedAt $synced-at } { lastSyncLaneIds $synced-ids } ]
          ; set [ ; add 'Synced ' ; add $synced-ids.length ' lane(s) to civil-memory.' ] sync-meta-el.textContent
          !set-deploy-status 'Lane synced to civil-memory!'
         ) }
         { true (
          !set-deploy-status ''
          !set-deploy-error [ match { $res.error : $res.error } { true : 'Sync failed.' } ]
         ) }
        ]
       ) }
       { true : !set-deploy-error 'Sync API is not available.' }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to deploy-flow (
  !set-deploy-error ''
  !set-deploy-status ''
  ; to srv !selected-server
  [ match
   { [ propertyIs false view.kv-ready ] : !set-deploy-error 'Verify civil-memory KV ready before deploying.' }
   { [ propertyIs null srv ] : !set-deploy-error 'Select a target SSH server first.' }
   { true (
    ; to dep !persist-deployment null
    ; to bundle !collect-bundle
    ; to payload [ object
     { action deploy-lane }
     { server $srv }
     { deployment $dep }
     { syncBundle $bundle }
     { subtitle ; add $srv.user ; add '@' ; add $srv.host ; add ' · ' $dep.slug }
    ]
    !launch-terminal-action $payload (
     ; to { evt } $argv
     ; condition { propertyIs __CC_DEPLOY_OK__ evt.type } (
      ; to dep-at [ match { $evt.data.deployedAt : $evt.data.deployedAt } { true : !window.Date } ]
      ; to pub [ match { $evt.data.publicUrl : $evt.data.publicUrl } { true : $dep.publicUrl } ]
      [ match
       { $saveDeployedLaneScript (
        ; to snap-recs [ match
         { $bundle.lanes.0.records : $bundle.lanes.0.records }
         { true : $nb.line-records }
        ]
        !saveDeployedLaneScript $data $lane.id $snap-recs $dep-at
       ) }
      ]
      !persist-deployment [ object { lastDeployedAt $dep-at } { lastSyncedAt $dep-at } { publicUrl $pub } ]
      !set-deploy-status ; add 'Deployed live at ' $pub
      [ match
       { $lane-control.servers-modal.refresh : !lane-control.servers-modal.refresh }
      ]
      [ match
       { $lane-control.refresh-export-statuses : !lane-control.refresh-export-statuses $lane.id }
      ]
     )
    )
   ) }
  ]
 )

 ; to service-action-flow (
  ; to { svc-act } $argv
  !set-deploy-error ''
  ; to srv !selected-server
  [ match
   { [ propertyIs null srv ] : !set-deploy-error 'Select a target SSH server first.' }
   { true (
    ; to dep !build-deployment-record null
    ; to payload [ object
     { action service-action }
     { serviceAction $svc-act }
     { server $srv }
     { deployment $dep }
     { subtitle ; add $srv.user ; add '@' $srv.host }
    ]
    !launch-terminal-action $payload null
   ) }
  ]
 )

 ; to undeploy-flow (
  !set-deploy-error ''
  ; to srv !selected-server
  [ match
   { [ propertyIs null srv ] : !set-deploy-error 'Select a target SSH server first.' }
   { true (
    ; to dep !build-deployment-record null
    ; to do-undep (
     ; to payload [ object
      { action undeploy-lane }
      { server $srv }
      { deployment $dep }
      { subtitle ; add $srv.user ; add '@' $srv.host }
     ]
     !launch-terminal-action $payload (
      ; to { evt } $argv
      ; condition { propertyIs __CC_UNDEPLOY_OK__ evt.type } (
       [ match
        { $deleteLaneDeployment : !deleteLaneDeployment $data $lane.id }
       ]
       ; set null view.deployment
       !set-deploy-status ; add 'Undeployed ' $dep.slug
      )
     )
    )
    [ match
     { $lane-control.confirm-modal.open (
      !lane-control.confirm-modal.open [ object
       { title 'Undeploy Lane Service' }
       { message ; add 'Stop and remove "' ; add $dep.slug ; add '" from ' ; add $srv.host '?' }
       { confirm-label Undeploy }
       { on-confirm $do-undep }
      ]
     ) }
     { true : !do-undep }
    ]
   ) }
  ]
 )

 ; to apply-server-defaults (
  ; to srv !selected-server
  [ match
   { $srv (
    ; to cur-kv-url !kv-url-input.value.trim
    [ match
     { [ propertyIs '' cur-kv-url ] (
      ; to def-url [ match
       { $srv.civilMemoryUrl : $srv.civilMemoryUrl }
       { [ propertyIs local srv.civilMemoryMode ] : ; add 'http://127.0.0.1:' $srv.civilMemoryPort }
       { true : '' }
      ]
      ; set $def-url kv-url-input.value
     ) }
    ]
    ; to cur-domain !domain-input.value.trim
    [ match
     { [ propertyIs '' cur-domain ] : ; set [ match { $srv.defaultDomain : $srv.defaultDomain } { true : '' } ] domain-input.value }
    ]
    [ match
     { $loadDeployments (
      ; to all-deps !loadDeployments $data
      ; to has-saved [ match { $view.deployment.port : true } { true : false } ]
      [ match
       { [ propertyIs false has-saved ] (
        ; to next-p !allocateNextPort $all-deps $srv.id $srv.basePort
        ; set [ ; add '' $next-p ] port-input.value
       ) }
      ]
     ) }
    ]
    !sync-route-ui
   ) }
  ]
  !sync-gate-ui
 )

 ; to view.refresh-servers (
  -- Reloads SSH servers dropdown and initializes deployment fields if needed
  ; to prev-val $srv-select.value
  !clear-children $srv-select
  ; set 0 view.server-option-els.length
  ; to none-opt !document.createElement option
  ; assign $none-opt { value '' } { textContent 'Select SSH server…' }
  !srv-select.appendChild $none-opt
  !view.server-option-els.push $none-opt

  ; to servers [ match
   { $loadDeployServers : !loadDeployServers $data }
   { true : {} }
  ]
  ; set $servers view.servers
  ; each $servers (
   ; to { s } $argv
   ; to opt !document.createElement option
   ; to lbl ; add $s.name ; add ' (' ; add $s.user ; add '@' ; add $s.host ')'
   ; assign $opt { value $s.id } { textContent $lbl }
   !srv-select.appendChild $opt
   !view.server-option-els.push $opt
  )
  ; to target-val [ match
   { $view.deployment.serverId : $view.deployment.serverId }
   { $prev-val : $prev-val }
   { true : '' }
  ]
  ; set $target-val srv-select.value
  !apply-server-defaults
 )

 ; to view.load (
  -- Loads persisted deployment configuration and server list for this lane
  ; to dep [ match
   { $loadLaneDeployment : !loadLaneDeployment $data $lane.id }
   { true : null }
  ]
  ; set $dep view.deployment
  [ match
   { $dep (
    ; set $dep.slug slug-input.value
    ; set [ ; add '' $dep.port ] port-input.value
    ; set $dep.routeMode rmode-select.value
    ; set $dep.domain domain-input.value
    ; set $dep.subpath subpath-input.value
    ; set [ ternary $dep.enableLetsEncrypt true false ] le-check.checked
    ; set $dep.letsEncryptEmail le-email-input.value
    ; set [ ternary $dep.cors true false ] cors-check.checked
    ; set $dep.civilMemoryUrl kv-url-input.value
    ; set $dep.dataBasePath kv-base-input.value
    ; set [ ternary $dep.includeImports true false ] imports-check.checked
    ; set [ ternary $dep.kvReady true false ] view.kv-ready
    [ match
     { $dep.lastSyncedAt : ; set [ ; add 'Last synced: ' $dep.lastSyncedAt ] sync-meta-el.textContent }
    ]
   ) }
  ]
  !view.refresh-servers
  !sync-route-ui
  !sync-gate-ui
 )

 !mock-mode-btn.addEventListener click (
  ; set mock view.tester-mode
  ; set 'lane-tab lane-tab--active' mock-mode-btn.className
  ; set lane-tab live-mode-btn.className
 )
 !live-mode-btn.addEventListener click (
  ; set live view.tester-mode
  ; set lane-tab mock-mode-btn.className
  ; set 'lane-tab lane-tab--active' live-mode-btn.className
 )
 !extra-toggle.addEventListener click (
  ; to next [ ternary $view.headers-open false true ]
  ; set $next view.headers-open
  ; set [ ternary $next false true ] extra-box.hidden
  ; set [ ternary $next '▾ Headers & Body' '▸ Headers & Body' ] extra-toggle.textContent
 )
 !resp-details-toggle.addEventListener click (
  ; to next [ ternary $view.resp-meta-open false true ]
  ; set $next view.resp-meta-open
  ; set [ ternary $next false true ] resp-details-box.hidden
  ; set [ ternary $next '▾ Response Headers & Logs' '▸ Response Headers & Logs' ] resp-details-toggle.textContent
 )
 !send-btn.addEventListener click $run-tester-request

 !servers-btn.addEventListener click (
  [ match
   { $lane-control.servers-modal.open : !lane-control.servers-modal.open servers }
  ]
 )
 !srv-select.addEventListener change (
  ; set false view.kv-ready
  !apply-server-defaults
 )
 !kv-url-input.addEventListener input (
  ; set false view.kv-ready
  !sync-gate-ui
 )
 !kv-base-input.addEventListener input (
  ; set false view.kv-ready
  !sync-gate-ui
 )
 !rmode-select.addEventListener change $sync-route-ui
 !domain-input.addEventListener input $sync-route-ui
 !subpath-input.addEventListener input $sync-route-ui
 !le-check.addEventListener change $sync-route-ui
 !slug-input.addEventListener input (
  !sync-route-ui
 )

 !verify-kv-btn.addEventListener click $verify-kv-flow
 !install-cm-btn.addEventListener click $install-cm-flow
 !sync-kv-btn.addEventListener click $sync-kv-flow
 !save-cfg-btn.addEventListener click (
  !persist-deployment null
  !set-deploy-status 'Deployment config saved.'
 )
 !deploy-btn.addEventListener click $deploy-flow
 !start-btn.addEventListener click : !service-action-flow start
 !restart-btn.addEventListener click : !service-action-flow restart
 !stop-btn.addEventListener click : !service-action-flow stop
 !logs-btn.addEventListener click : !service-action-flow logs
 !status-btn.addEventListener click : !service-action-flow status
 !undeploy-btn.addEventListener click $undeploy-flow

 !view.load
 $view
)
$scope
