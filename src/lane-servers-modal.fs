-- file lane-servers-modal.fs
; to scope ; object
; to scope.create (
 -- Creates full-screen Servers & Deployments manager modal (SSH targets, interactive shell, civil-memory setup, and deployed lane registry)
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop lane-session-backdrop cc-servers-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-config-modal lane-session-modal cc-servers-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-config-title-wrap title-wrap.className
 ; to heading-el !document.createElement div
 ; assign $heading-el { className lane-modal-title } { textContent 'Servers & Deployments' }
 ; to subtitle-el !document.createElement div
 ; assign $subtitle-el { className lane-config-id } { textContent 'Manage SSH targets, civil-memory KV instances, and deployed lane services' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading-el
 !title-wrap.appendChild $subtitle-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to nav-bar !document.createElement div
 ; set cc-servers-tabs nav-bar.className
 ; to tab-servers-btn !document.createElement button
 ; assign $tab-servers-btn { type button } { className 'lane-tab lane-tab--active' } { textContent 'SSH Servers' }
 ; to tab-deps-btn !document.createElement button
 ; assign $tab-deps-btn { type button } { className lane-tab } { textContent 'Deployed Lanes' }
 !nav-bar.appendChild $tab-servers-btn
 !nav-bar.appendChild $tab-deps-btn

 ; to error-el !document.createElement div
 ; assign $error-el { className lane-session-error } { textContent '' } { hidden true }

 ; to status-el !document.createElement div
 ; assign $status-el { className cc-status-banner } { textContent '' } { hidden true }

 -- Tab 1: SSH Servers
 ; to servers-page !document.createElement div
 ; set cc-servers-page servers-page.className

 ; to srv-toolbar !document.createElement div
 ; set lane-page-toolbar srv-toolbar.className
 ; to add-srv-btn !document.createElement button
 ; assign $add-srv-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent '+ Add Server' }
 ; to refresh-srv-btn !document.createElement button
 ; assign $refresh-srv-btn { type button } { className lane-modal-action } { textContent Refresh }
 !srv-toolbar.appendChild $add-srv-btn
 !srv-toolbar.appendChild $refresh-srv-btn

 ; to servers-list !document.createElement div
 ; set lane-modal-list servers-list.className

 ; to srv-form !document.createElement form
 ; assign $srv-form { className cc-server-form } { hidden true }
 ; to form-title-el !document.createElement div
 ; assign $form-title-el { className cc-section-title } { textContent 'Add SSH Server' }

 ; to mk-field (
  ; to { lbl placeholder val type-str } $argv
  ; to wrap !document.createElement div
  ; set lane-config-field wrap.className
  ; to l !document.createElement label
  ; assign $l { className lane-config-label } { textContent $lbl }
  ; to inp !document.createElement input
  ; to t [ match { $type-str : $type-str } { true : text } ]
  ; assign $inp { type $t } { className lane-config-input } { placeholder $placeholder } { value $val } { spellcheck false } { autocomplete off }
  !wrap.appendChild $l
  !wrap.appendChild $inp
  ; object { wrap $wrap } { input $inp }
 )

 ; to form-grid !document.createElement div
 ; set cc-form-grid form-grid.className

 ; to f-name !mk-field 'Server Name' 'e.g. Production VPS' ''
 ; to f-host !mk-field 'Host / IP' 'e.g. 203.0.113.10 or server.example.com' ''
 ; to f-ssh-port !mk-field 'SSH Port' '22' '22'
 ; to f-user !mk-field 'SSH Username' 'root' 'root'
 ; to f-identity !mk-field 'Identity File (optional)' '~/.ssh/id_ed25519' ''
 ; to f-domain !mk-field 'Default Nginx Domain (optional)' 'api.example.com' ''
 ; to f-base-port !mk-field 'Base Service Port' '4100' '4100'
 ; to f-install-root !mk-field 'Remote Install Root' '/opt/civil-command' '/opt/civil-command'

 ; to cm-mode-wrap !document.createElement div
 ; set lane-config-field cm-mode-wrap.className
 ; to cm-mode-lbl !document.createElement label
 ; assign $cm-mode-lbl { className lane-config-label } { textContent 'civil-memory Connection Mode' }
 ; to cm-mode-select !document.createElement select
 ; set 'lane-input-type lane-config-input lane-config-select' cm-mode-select.className
 ; to opt-none !document.createElement option
 ; assign $opt-none { value none } { textContent 'Not configured' }
 ; to opt-local !document.createElement option
 ; assign $opt-local { value local } { textContent 'On this server (localhost)' }
 ; to opt-ext !document.createElement option
 ; assign $opt-ext { value external } { textContent 'External civil-memory URL' }
 !cm-mode-select.appendChild $opt-none
 !cm-mode-select.appendChild $opt-local
 !cm-mode-select.appendChild $opt-ext
 !cm-mode-wrap.appendChild $cm-mode-lbl
 !cm-mode-wrap.appendChild $cm-mode-select

 ; to f-cm-url !mk-field 'civil-memory URL' 'http://127.0.0.1:3333 or https://kv.example.com' ''
 ; to f-cm-port !mk-field 'civil-memory Local Port' '3333' '3333'
 ; to f-cm-data-root !mk-field 'Default KV Disk Data Root' '/opt/civil-command/data' '/opt/civil-command/data'
 ; to f-cm-expose !mk-field 'Expose civil-memory Domain on Install (optional)' 'kv.example.com' ''
 ; to f-cm-email !mk-field 'Let\'s Encrypt Email (optional)' 'admin@example.com' ''

 ; to cm-le-wrap !document.createElement div
 ; set 'lane-config-field cc-checkbox-field' cm-le-wrap.className
 ; to cm-le-lbl !document.createElement label
 ; set cc-checkbox-label cm-le-lbl.className
 ; to cm-le-input !document.createElement input
 ; assign $cm-le-input { type checkbox }
 ; to cm-le-text !document.createElement span
 ; assign $cm-le-text { textContent 'Run Let\'s Encrypt when exposing civil-memory domain' }
 !cm-le-lbl.appendChild $cm-le-input
 !cm-le-lbl.appendChild $cm-le-text
 !cm-le-wrap.appendChild $cm-le-lbl

 !form-grid.appendChild $f-name.wrap
 !form-grid.appendChild $f-host.wrap
 !form-grid.appendChild $f-ssh-port.wrap
 !form-grid.appendChild $f-user.wrap
 !form-grid.appendChild $f-identity.wrap
 !form-grid.appendChild $f-domain.wrap
 !form-grid.appendChild $f-base-port.wrap
 !form-grid.appendChild $f-install-root.wrap
 !form-grid.appendChild $cm-mode-wrap
 !form-grid.appendChild $f-cm-url.wrap
 !form-grid.appendChild $f-cm-port.wrap
 !form-grid.appendChild $f-cm-data-root.wrap
 !form-grid.appendChild $f-cm-expose.wrap
 !form-grid.appendChild $f-cm-email.wrap
 !form-grid.appendChild $cm-le-wrap

 ; to form-footer !document.createElement div
 ; set lane-config-footer form-footer.className
 ; to form-cancel-btn !document.createElement button
 ; assign $form-cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to form-save-btn !document.createElement button
 ; assign $form-save-btn { type submit } { className 'lane-modal-action lane-config-btn--save' } { textContent 'Save Server' }
 !form-footer.appendChild $form-cancel-btn
 !form-footer.appendChild $form-save-btn

 !srv-form.appendChild $form-title-el
 !srv-form.appendChild $form-grid
 !srv-form.appendChild $form-footer

 !servers-page.appendChild $srv-toolbar
 !servers-page.appendChild $servers-list
 !servers-page.appendChild $srv-form

 -- Tab 2: Deployed Lanes
 ; to deps-page !document.createElement div
 ; assign $deps-page { className cc-servers-page } { hidden true }
 ; to deps-toolbar !document.createElement div
 ; set lane-page-toolbar deps-toolbar.className
 ; to refresh-deps-btn !document.createElement button
 ; assign $refresh-deps-btn { type button } { className lane-modal-action } { textContent Refresh }
 !deps-toolbar.appendChild $refresh-deps-btn
 ; to deps-list !document.createElement div
 ; set lane-modal-list deps-list.className
 !deps-page.appendChild $deps-toolbar
 !deps-page.appendChild $deps-list

 !panel.appendChild $header
 !panel.appendChild $nav-bar
 !panel.appendChild $error-el
 !panel.appendChild $status-el
 !panel.appendChild $servers-page
 !panel.appendChild $deps-page
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { error-el $error-el }
  { status-el $status-el }
  { tab-servers-btn $tab-servers-btn }
  { tab-deps-btn $tab-deps-btn }
  { servers-page $servers-page }
  { deps-page $deps-page }
  { servers-list $servers-list }
  { deps-list $deps-list }
  { add-srv-btn $add-srv-btn }
  { refresh-srv-btn $refresh-srv-btn }
  { refresh-deps-btn $refresh-deps-btn }
  { srv-form $srv-form }
  { form-title-el $form-title-el }
  { form-cancel-btn $form-cancel-btn }
  { form-save-btn $form-save-btn }
  { fields [ object
   { name $f-name.input }
   { host $f-host.input }
   { sshPort $f-ssh-port.input }
   { user $f-user.input }
   { identityFile $f-identity.input }
   { defaultDomain $f-domain.input }
   { basePort $f-base-port.input }
   { installRoot $f-install-root.input }
   { civilMemoryMode $cm-mode-select }
   { civilMemoryUrl $f-cm-url.input }
   { civilMemoryPort $f-cm-port.input }
   { civilMemoryDataRoot $f-cm-data-root.input }
   { exposeDomain $f-cm-expose.input }
   { letsEncryptEmail $f-cm-email.input }
   { enableLetsEncrypt $cm-le-input }
  ] }
  { active-tab servers }
  { lane null }
  { editing-id '' }
  { editing-created-at null }
  { editing-verified false }
  { editing-checked-at null }
  { servers {} }
  { server-items {} }
  { deployments {} }
  { deployment-items {} }
  { is-open false }
 ]

 ; to clear-list (
  ; to { container } $argv
  [ match
   { $container.replaceChildren : !container.replaceChildren }
   { true (
    ; while { propertyIsGreaterThan 0 container.children.length } (
     ; to prev-len $container.children.length
     ; to idx ; subtract $prev-len 1
     ; to child [ get container.children $idx ]
     [ match
      { $child.remove : !child.remove }
     ]
     ; condition { propertyIs $prev-len container.children.length } : !container.children.pop
    )
    ; set '' container.textContent
   ) }
  ]
 )

 ; to set-error (
  ; to { msg } $argv
  ; to clean [ match
   { [ propertyIs null msg ] : '' }
   { [ propertyIs undefined msg ] : '' }
   { true : ; add '' $msg }
  ]
  ; set $clean error-el.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] error-el.hidden
 )

 ; to set-status (
  ; to { msg } $argv
  ; to clean [ match
   { [ propertyIs null msg ] : '' }
   { [ propertyIs undefined msg ] : '' }
   { true : ; add '' $msg }
  ]
  ; set $clean status-el.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] status-el.hidden
 )

 ; to safe-int (
  ; to { raw fallback } $argv
  ; to s [ match
   { [ propertyIs null raw ] : '' }
   { [ propertyIs undefined raw ] : '' }
   { true : ; add '' $raw }
  ]
  ; to trimmed !s.trim
  [ match
   { [ propertyIs '' trimmed ] : $fallback }
   { $window.Number (
    ; to n !window.Number $trimmed
    [ match
     { [ !window.Number.isInteger $n ] : $n }
     { true : $fallback }
    ]
   ) }
   { true : $fallback }
  ]
 )

 ; to notify-servers-updated (
  [ match
   { $lane-control.refresh-deploy-servers : !lane-control.refresh-deploy-servers }
  ]
 )

 ; to open-form (
  ; to { srv } $argv
  !set-error ''
  [ match
   { $srv (
    ; set $srv.id modal.editing-id
    ; set $srv.createdAt modal.editing-created-at
    ; set [ ternary $srv.civilMemoryVerified true false ] modal.editing-verified
    ; set $srv.civilMemoryLastCheckedAt modal.editing-checked-at
    ; set 'Edit SSH Server' form-title-el.textContent
    ; set $srv.name f-name.input.value
    ; set $srv.host f-host.input.value
    ; set [ ; add '' $srv.sshPort ] f-ssh-port.input.value
    ; set $srv.user f-user.input.value
    ; set [ match { $srv.identityFile : $srv.identityFile } { true : '' } ] f-identity.input.value
    ; set [ match { $srv.defaultDomain : $srv.defaultDomain } { true : '' } ] f-domain.input.value
    ; set [ ; add '' $srv.basePort ] f-base-port.input.value
    ; set [ match { $srv.installRoot : $srv.installRoot } { true : '/opt/civil-command' } ] f-install-root.input.value
    ; set [ match { $srv.civilMemoryMode : $srv.civilMemoryMode } { true : none } ] cm-mode-select.value
    ; set [ match { $srv.civilMemoryUrl : $srv.civilMemoryUrl } { true : '' } ] f-cm-url.input.value
    ; set [ ; add '' $srv.civilMemoryPort ] f-cm-port.input.value
    ; set [ match { $srv.civilMemoryDataRoot : $srv.civilMemoryDataRoot } { true : '/opt/civil-command/data' } ] f-cm-data-root.input.value
   ) }
   { true (
    ; set '' modal.editing-id
    ; set null modal.editing-created-at
    ; set false modal.editing-verified
    ; set null modal.editing-checked-at
    ; set 'Add SSH Server' form-title-el.textContent
    ; set '' f-name.input.value
    ; set '' f-host.input.value
    ; set '22' f-ssh-port.input.value
    ; set root f-user.input.value
    ; set '' f-identity.input.value
    ; set '' f-domain.input.value
    ; set '4100' f-base-port.input.value
    ; set '/opt/civil-command' f-install-root.input.value
    ; set none cm-mode-select.value
    ; set '' f-cm-url.input.value
    ; set '3333' f-cm-port.input.value
    ; set '/opt/civil-command/data' f-cm-data-root.input.value
    ; set '' f-cm-expose.input.value
    ; set '' f-cm-email.input.value
    ; set false cm-le-input.checked
   ) }
  ]
  ; set false srv-form.hidden
 )

 ; to close-form (
  ; set true srv-form.hidden
  ; set '' modal.editing-id
 )

 ; to launch-ssh-action (
  ; to { payload on-sentinel-cb on-exit-cb } $argv
  !set-error ''
  [ match
   { $startDeployTerminalSession (
    ; to resp !startDeployTerminalSession $payload
    [ match
     { [ propertyIs false resp.ok ] : !set-error [ match { $resp.error : $resp.error } { true : 'Failed to launch terminal session' } ] }
     { $lane-control.terminal-modal.open (
      ; to open-opts [ object
       { lane $modal.lane }
       { title $resp.title }
       { subtitle $payload.subtitle }
       { wsPath $resp.wsPath }
       { sessionId $resp.sessionId }
       { onSentinel $on-sentinel-cb }
       { onExit $on-exit-cb }
      ]
      !lane-control.terminal-modal.open $open-opts
     ) }
     { true : !set-error 'Terminal modal is not available' }
    ]
   ) }
   { true : !set-error 'Deploy terminal API is not available' }
  ]
 )

 ; to mark-server-kv-ready (
  ; to { srv next-url next-root } $argv
  ; to updated ; object
  ; assign $updated $srv [ object
   { civilMemoryMode [ match { [ propertyIs none srv.civilMemoryMode ] : local } { true : $srv.civilMemoryMode } ] }
   { civilMemoryUrl $next-url }
   { civilMemoryDataRoot [ match { $next-root : $next-root } { true : $srv.civilMemoryDataRoot } ] }
   { civilMemoryVerified true }
   { civilMemoryLastCheckedAt !window.Date }
  ]
  [ match
   { $saveDeployServer : !saveDeployServer $data $updated }
  ]
  !modal.refresh
  !notify-servers-updated
 )

 ; to verify-server-kv (
  ; to { srv } $argv
  !set-error ''
  !set-status ''
  ; to target-url [ match
   { $srv.civilMemoryUrl : $srv.civilMemoryUrl }
   { [ propertyIs local srv.civilMemoryMode ] : ; add 'http://127.0.0.1:' $srv.civilMemoryPort }
   { true : '' }
  ]
  [ match
   { [ propertyIs '' target-url ] : !set-error 'Configure a civil-memory URL or install civil-memory on this server first.' }
   { [ propertyIs external srv.civilMemoryMode ] (
    [ match
     { $testRemoteCivilMemory (
      !set-status 'Testing external civil-memory KV...'
      ; to res !testRemoteCivilMemory [ object { url $target-url } { basePath $srv.civilMemoryDataRoot } ]
      [ match
       { [ propertyIs true res.ok ] (
        !mark-server-kv-ready $srv $target-url $srv.civilMemoryDataRoot
        !set-status ; add 'civil-memory ready (' ; add $target-url ')'
       ) }
       { true (
        !set-status ''
        !set-error [ match { $res.error : $res.error } { true : 'civil-memory verification failed' } ]
       ) }
      ]
     ) }
     { true : !set-error 'Deploy KV API is not available' }
    ]
   ) }
   { true (
    ; to payload [ object
     { action test-kv }
     { server $srv }
     { url $target-url }
     { basePath $srv.civilMemoryDataRoot }
     { subtitle ; add $srv.user ; add '@' $srv.host }
    ]
    !launch-ssh-action $payload (
     ; to { evt } $argv
     ; condition { propertyIs __CC_KV_READY__ evt.type } (
      !mark-server-kv-ready $srv $target-url $srv.civilMemoryDataRoot
      !set-status ; add 'civil-memory ready on ' $srv.name
     )
    ) null
   ) }
  ]
 )

 ; to install-civil-memory (
  ; to { srv } $argv
  ; to expose !f-cm-expose.input.value.trim
  ; to email !f-cm-email.input.value.trim
  ; to le $cm-le-input.checked
  ; to payload [ object
   { action install-civil-memory }
   { server $srv }
   { exposeDomain $expose }
   { enableLetsEncrypt $le }
   { letsEncryptEmail $email }
   { subtitle ; add 'Installing civil-memory on ' $srv.host }
  ]
  !launch-ssh-action $payload (
   ; to { evt } $argv
   ; condition { propertyIs __CC_CIVIL_MEMORY_READY__ evt.type } (
    ; to next-url [ match
     { $evt.data.exposedUrl : $evt.data.exposedUrl }
     { $evt.data.url : $evt.data.url }
     { true : ; add 'http://127.0.0.1:' $srv.civilMemoryPort }
    ]
    ; to next-root [ match
     { $evt.data.defaultDataRoot : $evt.data.defaultDataRoot }
     { true : $srv.civilMemoryDataRoot }
    ]
    ; to updated ; object
    ; assign $updated $srv [ object
     { civilMemoryMode local }
     { civilMemoryUrl $next-url }
     { civilMemoryDataRoot $next-root }
     { civilMemoryVerified true }
     { civilMemoryLastCheckedAt !window.Date }
    ]
    [ match
     { $saveDeployServer : !saveDeployServer $data $updated }
    ]
    !modal.refresh
    !notify-servers-updated
    !set-status ; add 'civil-memory installed & ready on ' $srv.name
   )
  ) null
 )

 ; to render-servers (
  !clear-list $servers-list
  ; set 0 modal.server-items.length
  ; to list [ match
   { $loadDeployServers : !loadDeployServers $data }
   { true : {} }
  ]
  ; set $list modal.servers
  [ match
   { [ propertyIs 0 list.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-modal-empty } { textContent 'No SSH servers saved yet. Click "+ Add Server" to configure a deployment target.' }
    !servers-list.appendChild $empty-el
   ) }
   { true (
    ; each $list (
     ; to { srv } $argv
     ; to item !document.createElement div
     ; set lane-modal-item item.className
     ; to info !document.createElement div
     ; set lane-modal-item-info info.className
     ; to title-row !document.createElement div
     ; set cc-item-title-row title-row.className
     ; to name-el !document.createElement div
     ; assign $name-el { className lane-modal-item-title } { textContent $srv.name }
     ; to kv-badge !document.createElement span
     ; to kv-ready [ match
      { [ propertyIs none srv.civilMemoryMode ] : false }
      { [ propertyIs '' srv.civilMemoryUrl ] : false }
      { [ propertyIs true srv.civilMemoryVerified ] : true }
      { true : false }
     ]
     ; to kv-txt [ match
      { $kv-ready : ; add 'KV Ready · ' $srv.civilMemoryUrl }
      { $srv.civilMemoryUrl : ; add 'KV Unverified · ' $srv.civilMemoryUrl }
      { true : 'KV Not Configured' }
     ]
     ; set [ ternary $kv-ready 'cc-badge cc-badge--ok' 'cc-badge cc-badge--warn' ] kv-badge.className
     ; set $kv-txt kv-badge.textContent
     !title-row.appendChild $name-el
     !title-row.appendChild $kv-badge

     ; to meta-el !document.createElement div
     ; to ssh-str ; add $srv.user ; add '@' ; add $srv.host ; add ':' $srv.sshPort
     ; to dom-str [ match
      { $srv.defaultDomain : ; add ' · domain: ' $srv.defaultDomain }
      { true : '' }
     ]
     ; to meta-txt ; add $ssh-str ; add $dom-str ; add ' · root: ' $srv.installRoot
     ; assign $meta-el { className lane-modal-item-id } { textContent $meta-txt }
     !info.appendChild $title-row
     !info.appendChild $meta-el

     ; to acts !document.createElement div
     ; set lane-modal-item-actions acts.className
     ; to shell-btn !document.createElement button
     ; assign $shell-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Shell }
     ; to verify-btn !document.createElement button
     ; assign $verify-btn { type button } { className lane-modal-action } { textContent 'Verify KV' }
     ; to install-btn !document.createElement button
     ; assign $install-btn { type button } { className lane-modal-action } { textContent 'Install civil-memory' }
     ; to edit-btn !document.createElement button
     ; assign $edit-btn { type button } { className lane-modal-action } { textContent Edit }
     ; to del-btn !document.createElement button
     ; assign $del-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Delete }

     !acts.appendChild $shell-btn
     !acts.appendChild $verify-btn
     !acts.appendChild $install-btn
     !acts.appendChild $edit-btn
     !acts.appendChild $del-btn

     !shell-btn.addEventListener click (
      ; to sh-payload [ object
       { action shell }
       { server $srv }
       { subtitle ; add $srv.user ; add '@' ; add $srv.host ; add ':' $srv.sshPort }
      ]
      !launch-ssh-action $sh-payload null null
     )
     !verify-btn.addEventListener click : !verify-server-kv $srv
     !install-btn.addEventListener click : !install-civil-memory $srv
     !edit-btn.addEventListener click : !open-form $srv
     !del-btn.addEventListener click (
      ; to confirm-del (
       [ match
        { $deleteDeployServer : !deleteDeployServer $data $srv.id }
       ]
       !modal.refresh
       !notify-servers-updated
      )
      [ match
       { $lane-control.confirm-modal.open (
        !lane-control.confirm-modal.open [ object
         { lane $modal.lane }
         { title 'Delete Server' }
         { message ; add 'Remove saved SSH server "' ; add $srv.name '"? (Remote services on the host are not deleted.)' }
         { confirm-label Delete }
         { on-confirm $confirm-del }
        ]
       ) }
       { true : !confirm-del }
      ]
     )

     !item.appendChild $info
     !item.appendChild $acts
     !servers-list.appendChild $item
     !modal.server-items.push [ object { server $srv } { el $item } { shell-btn $shell-btn } { verify-btn $verify-btn } { install-btn $install-btn } { edit-btn $edit-btn } { del-btn $del-btn } ]
    )
   ) }
  ]
 )

 ; to find-server (
  ; to { srv-id } $argv
  ; to found ; object { val null }
  ; each $modal.servers (
   ; to { s } $argv
   ; condition { propertyIs $srv-id s.id } : ; set $s found.val
  )
  $found.val
 )

 ; to render-deployments (
  !clear-list $deps-list
  ; set 0 modal.deployment-items.length
  ; to deps [ match
   { $loadDeployments : !loadDeployments $data }
   { true : {} }
  ]
  ; set $deps modal.deployments
  [ match
   { [ propertyIs 0 deps.length ] (
    ; to empty-el !document.createElement div
    ; assign $empty-el { className lane-modal-empty } { textContent 'No lanes deployed yet. Enable "HTTP Server" in a lane\'s Configure modal and open its Server tab.' }
    !deps-list.appendChild $empty-el
   ) }
   { true (
    ; each $deps (
     ; to { dep } $argv
     ; to srv !find-server $dep.serverId
     ; to item !document.createElement div
     ; set lane-modal-item item.className
     ; to info !document.createElement div
     ; set lane-modal-item-info info.className
     ; to title-el !document.createElement div
     ; to title-txt [ match { $dep.title : $dep.title } { true : $dep.laneId } ]
     ; assign $title-el { className lane-modal-item-title } { textContent ; add $title-txt ; add ' (' ; add $dep.slug ')' }
     ; to meta-el !document.createElement div
     ; to srv-name [ match { $srv.name : $srv.name } { true : $dep.serverId } ]
     ; to url-part [ match { $dep.publicUrl : ; add ' · ' $dep.publicUrl } { true : '' } ]
     ; to meta-txt ; add $srv-name ; add ' · 127.0.0.1:' ; add $dep.port ; add $url-part ; add ' · KV base: ' [ match { $dep.dataBasePath : $dep.dataBasePath } { true : Default } ]
     ; assign $meta-el { className lane-modal-item-id } { textContent $meta-txt }
     !info.appendChild $title-el
     !info.appendChild $meta-el

     ; to acts !document.createElement div
     ; set lane-modal-item-actions acts.className
     ; to open-btn !document.createElement button
     ; assign $open-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent 'Open Lane' }
     ; to logs-btn !document.createElement button
     ; assign $logs-btn { type button } { className lane-modal-action } { textContent Logs }
     ; to restart-btn !document.createElement button
     ; assign $restart-btn { type button } { className lane-modal-action } { textContent Restart }
     ; to stop-btn !document.createElement button
     ; assign $stop-btn { type button } { className lane-modal-action } { textContent Stop }
     ; to undep-btn !document.createElement button
     ; assign $undep-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Undeploy }

     !acts.appendChild $open-btn
     !acts.appendChild $logs-btn
     !acts.appendChild $restart-btn
     !acts.appendChild $stop-btn
     !acts.appendChild $undep-btn

     !open-btn.addEventListener click (
      !modal.close
      [ match
       { $lane-control.open (
        [ match
         { $lane-control.begin-session-status-pending : !lane-control.begin-session-status-pending 'Loading…' }
        ]
        ; try (
         !lane-control.open $dep.laneId server
         !lane-control.update-url
        ) : null
        [ match
         { $lane-control.end-session-status-pending : !lane-control.end-session-status-pending }
        ]
       ) }
      ]
     )

     ; to run-svc-act (
      ; to { svc-act } $argv
      [ match
       { $srv (
        ; to p [ object
         { action service-action }
         { serviceAction $svc-act }
         { server $srv }
         { deployment $dep }
         { subtitle ; add $srv.user ; add '@' $srv.host }
        ]
        !launch-ssh-action $p null null
       ) }
       { true : !set-error 'Target SSH server not found for this deployment.' }
      ]
     )

     !logs-btn.addEventListener click : !run-svc-act logs
     !restart-btn.addEventListener click : !run-svc-act restart
     !stop-btn.addEventListener click : !run-svc-act stop
     !undep-btn.addEventListener click (
      [ match
       { $srv (
        ; to do-undep (
         ; to p [ object
          { action undeploy-lane }
          { server $srv }
          { deployment $dep }
          { subtitle ; add $srv.user ; add '@' $srv.host }
         ]
         !launch-ssh-action $p (
          ; to { evt } $argv
          ; condition { propertyIs __CC_UNDEPLOY_OK__ evt.type } (
           [ match
            { $deleteLaneDeployment : !deleteLaneDeployment $data $dep.laneId $dep.id }
           ]
           !modal.refresh
           !notify-servers-updated
          )
         ) null
        )
        [ match
         { $lane-control.confirm-modal.open (
          !lane-control.confirm-modal.open [ object
           { lane $modal.lane }
           { title 'Undeploy Lane Service' }
           { message ; add 'Stop and remove remote service "' ; add $dep.slug ; add '" from ' ; add $srv.host '?' }
           { confirm-label Undeploy }
           { on-confirm $do-undep }
          ]
         ) }
         { true : !do-undep }
        ]
       ) }
       { true : !set-error 'Target SSH server not found for this deployment.' }
      ]
     )

     !item.appendChild $info
     !item.appendChild $acts
     !deps-list.appendChild $item
     !modal.deployment-items.push [ object { deployment $dep } { el $item } { open-btn $open-btn } { logs-btn $logs-btn } { restart-btn $restart-btn } { stop-btn $stop-btn } { undep-btn $undep-btn } ]
    )
   ) }
  ]
 )

 ; to modal.set-tab (
  ; to { next-tab } $argv
  ; to is-deps [ propertyIs deployments next-tab ]
  ; set [ ternary $is-deps deployments servers ] modal.active-tab
  ; set [ ternary $is-deps lane-tab 'lane-tab lane-tab--active' ] tab-servers-btn.className
  ; set [ ternary $is-deps 'lane-tab lane-tab--active' lane-tab ] tab-deps-btn.className
  ; set $is-deps servers-page.hidden
  ; set [ ternary $is-deps false true ] deps-page.hidden
 )

 ; to modal.refresh (
  !render-servers
  !render-deployments
 )

 ; to modal.close (
  ; condition { propertyIs true modal.is-open } (
   ; to prev-lane $modal.lane
   ; set false modal.is-open
   ; set null modal.lane
   !set-error ''
   !set-status ''
   !close-form
   !backdrop.remove
   [ match
    { [ and { $prev-lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $prev-lane $modal }
   ]
  )
 )

 ; to modal.open (
  ; to { initial-tab target-lane } $argv
  !set-error ''
  !set-status ''
  !close-form
  !modal.refresh
  ; condition { propertyIs 0 modal.servers.length } : !open-form null
  ; to start-tab [ match
   { [ propertyIs deployments initial-tab ] : deployments }
   { true : servers }
  ]
  !modal.set-tab $start-tab
  ; condition { propertyIs true modal.is-open } (
   [ match
    { [ and { $modal.lane } { $lane-control.unmount-lane-modal } ] : !lane-control.unmount-lane-modal $modal.lane $modal }
   ]
  )
  ; to resolved-lane [ match
   { $target-lane.id : $target-lane }
   { [ and { $target-lane } { $lane-control.resolve-lane } ] : !lane-control.resolve-lane $target-lane }
   { true : null }
  ]
  ; set $resolved-lane modal.lane
  ; set true modal.is-open
  [ match
   { [ and { $resolved-lane } { $lane-control.mount-lane-modal } ] : !lane-control.mount-lane-modal $resolved-lane $modal }
   { $lane-control.mount-lane-modal : !lane-control.mount-lane-modal null $modal }
   { $document.body.appendChild : !document.body.appendChild $backdrop }
  ]
  $modal
 )

 !tab-servers-btn.addEventListener click : !modal.set-tab servers
 !tab-deps-btn.addEventListener click : !modal.set-tab deployments
 !add-srv-btn.addEventListener click : !open-form null
 !refresh-srv-btn.addEventListener click : !modal.refresh
 !refresh-deps-btn.addEventListener click : !modal.refresh
 !form-cancel-btn.addEventListener click : !close-form

 !srv-form.addEventListener submit (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  !set-error ''
  ; to host !f-host.input.value.trim
  ; to raw-name !f-name.input.value.trim
  ; to name [ match { $raw-name : $raw-name } { true : $host } ]
  [ match
   { [ propertyIs '' host ] : !set-error 'SSH Host is required.' }
   { true (
    ; to ssh-port !safe-int $f-ssh-port.input.value 22
    ; to raw-user !f-user.input.value.trim
    ; to user [ match { $raw-user : $raw-user } { true : root } ]
    ; to base-port !safe-int $f-base-port.input.value 4100
    ; to raw-root !f-install-root.input.value.trim
    ; to install-root [ match { $raw-root : $raw-root } { true : '/opt/civil-command' } ]
    ; to cm-mode $cm-mode-select.value
    ; to cm-port !safe-int $f-cm-port.input.value 3333
    ; to raw-cm-url !f-cm-url.input.value.trim
    ; to cm-url [ match
     { $raw-cm-url : $raw-cm-url }
     { [ propertyIs local cm-mode ] : ; add 'http://127.0.0.1:' $cm-port }
     { true : '' }
    ]
    ; to raw-cm-root !f-cm-data-root.input.value.trim
    ; to cm-data-root [ match { $raw-cm-root : $raw-cm-root } { true : '/opt/civil-command/data' } ]
    ; to record [ object
     { id $modal.editing-id }
     { name $name }
     { host $host }
     { sshPort $ssh-port }
     { user $user }
     { identityFile !f-identity.input.value.trim }
     { defaultDomain !f-domain.input.value.trim }
     { basePort $base-port }
     { installRoot $install-root }
     { civilMemoryMode $cm-mode }
     { civilMemoryUrl $cm-url }
     { civilMemoryPort $cm-port }
     { civilMemoryDataRoot $cm-data-root }
     { civilMemoryVerified false }
     { createdAt $modal.editing-created-at }
    ]
    [ match
     { $saveDeployServer : !saveDeployServer $data $record }
    ]
    !close-form
    !modal.refresh
    !notify-servers-updated
    !set-status ; add 'Saved server "' ; add $name '"'
   ) }
  ]
 )

 !close-btn.addEventListener click $modal.close
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
   )
  ) }
 ]

 $modal
)
$scope
