-- file lane-terminal-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a reusable interactive SSH PTY terminal modal dialog
 ; to { host } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop cc-term-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-config-modal cc-term-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-config-title-wrap title-wrap.className
 ; to title-el !document.createElement div
 ; assign $title-el { className lane-modal-title } { textContent 'SSH Terminal' }
 ; to subtitle-el !document.createElement div
 ; assign $subtitle-el { className lane-config-id } { textContent '' }
 !title-wrap.appendChild $title-el
 !title-wrap.appendChild $subtitle-el

 ; to header-right !document.createElement div
 ; set cc-term-header-right header-right.className
 ; to status-el !document.createElement span
 ; assign $status-el { className cc-term-status } { textContent 'Connecting…' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title Close }
 !header-right.appendChild $status-el
 !header-right.appendChild $close-btn

 !header.appendChild $title-wrap
 !header.appendChild $header-right

 ; to notice-el !document.createElement div
 ; assign $notice-el { className cc-term-notice } { textContent 'Click terminal to type SSH/sudo passwords, host-key confirmations, or interactive prompts.' }

 ; to host-el !document.createElement div
 ; set cc-term-host host-el.className

 ; to toolbar !document.createElement div
 ; set cc-term-toolbar toolbar.className
 ; to toolbar-left !document.createElement div
 ; set cc-term-toolbar-group toolbar-left.className
 ; to ctrlc-btn !document.createElement button
 ; assign $ctrlc-btn { type button } { className lane-modal-action } { textContent 'Ctrl+C' } { title 'Send interrupt (SIGINT)' }
 ; to copy-btn !document.createElement button
 ; assign $copy-btn { type button } { className lane-modal-action } { textContent 'Copy Log' }
 ; to kill-btn !document.createElement button
 ; assign $kill-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Kill }
 !toolbar-left.appendChild $ctrlc-btn
 !toolbar-left.appendChild $copy-btn
 !toolbar-left.appendChild $kill-btn

 ; to done-btn !document.createElement button
 ; assign $done-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent Close }
 !toolbar.appendChild $toolbar-left
 !toolbar.appendChild $done-btn

 !panel.appendChild $header
 !panel.appendChild $notice-el
 !panel.appendChild $host-el
 !panel.appendChild $toolbar
 !backdrop.appendChild $panel

 ; to default-notice 'Click terminal to type SSH/sudo passwords, host-key confirmations, or interactive prompts.'

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { title-el $title-el }
  { subtitle-el $subtitle-el }
  { status-el $status-el }
  { notice-el $notice-el }
  { host-el $host-el }
  { ctrlc-btn $ctrlc-btn }
  { copy-btn $copy-btn }
  { kill-btn $kill-btn }
  { done-btn $done-btn }
  { close-btn $close-btn }
  { is-open false }
  { status connecting }
  { exit-code null }
  { session-id '' }
  { close-armed false }
  { term null }
  { on-sentinel null }
  { on-exit null }
  { on-close null }
  { host $host }
 ]

 ; to clear-host (
  -- Safely empties host-el across both real and mock DOM environments
  [ match
   { $host-el.replaceChildren : !host-el.replaceChildren }
   { true (
    ; while { propertyIsGreaterThan 0 host-el.children.length } (
     ; to prev-len $host-el.children.length
     ; to idx ; subtract $prev-len 1
     ; to child [ get host-el.children $idx ]
     [ match
      { $child.remove : !child.remove }
     ]
     ; condition { propertyIs $prev-len host-el.children.length } : !host-el.children.pop
    )
    ; set '' host-el.textContent
   ) }
  ]
 )

 ; to sync-status-ui (
  -- Updates status badge and action buttons from modal.status and modal.exit-code
  ; to st $modal.status
  ; to is-running [ propertyIs running st ]
  ; to is-connecting [ propertyIs connecting st ]
  ; to is-active [ match { $is-running : true } { $is-connecting : true } { true : false } ]
  ; to is-exited [ propertyIs exited st ]
  ; to label [ match
   { $is-running : Live }
   { $is-connecting : 'Connecting…' }
   { $is-exited (
    ; to code [ match
     { [ propertyIs null modal.exit-code ] : 0 }
     { [ propertyIs undefined modal.exit-code ] : 0 }
     { true : $modal.exit-code }
    ]
    ; add 'Exited (' ; add $code ')'
   ) }
   { [ propertyIs error st ] : 'Connection Error' }
   { true : $st }
  ]
  ; to cls [ match
   { $is-running : 'cc-term-status cc-term-status--live' }
   { $is-exited (
    [ match
     { [ propertyIs 0 modal.exit-code ] : 'cc-term-status cc-term-status--ok' }
     { true : 'cc-term-status cc-term-status--err' }
    ]
   ) }
   { [ propertyIs error st ] : 'cc-term-status cc-term-status--err' }
   { true : cc-term-status }
  ]
  ; set $label status-el.textContent
  ; set $cls status-el.className
  ; set [ ternary $is-active false true ] ctrlc-btn.disabled
  ; set [ ternary $is-active false true ] kill-btn.disabled
  [ match
   { $is-active : null }
   { true : ; set false modal.close-armed }
  ]
 )

 ; to modal.close (
  -- Closes the terminal modal, disconnects WebSocket, and invokes optional on-close callback
  ; to { force } $argv
  ; to is-running [ propertyIs running modal.status ]
  ; to should-warn [ match
   { [ propertyIs false is-running ] : false }
   { [ propertyIs true force ] : false }
   { [ propertyIs true modal.close-armed ] : false }
   { true : true }
  ]
  [ match
   { $should-warn (
    ; set true modal.close-armed
    ; set 'Process is still running — click Kill to terminate or click Close again to disconnect.' notice-el.textContent
    ; set 'cc-term-notice cc-term-notice--warn' notice-el.className
    null
   ) }
   { true (
    ; set false modal.close-armed
    ; to close-cb $modal.on-close
    [ match
     { $modal.term (
      !modal.term.disconnect
      ; set null modal.term
     ) }
    ]
    ; condition { propertyIs true modal.is-open } (
     ; set false modal.is-open
     ; set '' modal.session-id
     ; set null modal.on-sentinel
     ; set null modal.on-exit
     ; set null modal.on-close
     !backdrop.remove
    )
    [ match
     { $close-cb : !$close-cb }
    ]
   ) }
  ]
 )

 ; to modal.open (
  -- Opens the interactive SSH terminal modal for a backend PTY session
  ; to { opts } $argv
  [ match
   { $modal.term (
    !modal.term.disconnect
    ; set null modal.term
   ) }
  ]
  !clear-host

  ; to title [ match
   { $opts.title : $opts.title }
   { true : 'SSH Terminal' }
  ]
  ; to subtitle [ match
   { $opts.subtitle : $opts.subtitle }
   { true : '' }
  ]
  ; to ws-path [ match
   { $opts.ws-path : $opts.ws-path }
   { $opts.wsPath : $opts.wsPath }
   { true : '' }
  ]
  ; to session-id [ match
   { $opts.session-id : $opts.session-id }
   { $opts.sessionId : $opts.sessionId }
   { true : '' }
  ]
  ; to on-sentinel [ match
   { $opts.on-sentinel : $opts.on-sentinel }
   { $opts.onSentinel : $opts.onSentinel }
   { true : null }
  ]
  ; to on-exit [ match
   { $opts.on-exit : $opts.on-exit }
   { $opts.onExit : $opts.onExit }
   { true : null }
  ]
  ; to on-close [ match
   { $opts.on-close : $opts.on-close }
   { $opts.onClose : $opts.onClose }
   { true : null }
  ]

  ; set $title title-el.textContent
  ; set $subtitle subtitle-el.textContent
  ; set $default-notice notice-el.textContent
  ; set cc-term-notice notice-el.className
  ; set 'Copy Log' copy-btn.textContent
  ; set $session-id modal.session-id
  ; set connecting modal.status
  ; set null modal.exit-code
  ; set false modal.close-armed
  ; set $on-sentinel modal.on-sentinel
  ; set $on-exit modal.on-exit
  ; set $on-close modal.on-close
  !sync-status-ui

  ; to term-opts [ object
   { wsUrl $ws-path }
   { cols 100 }
   { rows 28 }
   { document $document }
   { window $window }
   { onStatus (
    ; to { info } $argv
    ; to next-st [ match
     { $info.status : $info.status }
     { true : running }
    ]
    ; set $next-st modal.status
    ; set $info.exitCode modal.exit-code
    !sync-status-ui
    ; condition { propertyIs exited next-st } (
     ; to exit-cb $modal.on-exit
     [ match
      { $exit-cb : !$exit-cb $info }
     ]
    )
   ) }
   { onSentinel (
    ; to { evt } $argv
    ; to sent-cb $modal.on-sentinel
    [ match
     { $sent-cb : !$sent-cb $evt }
    ]
   ) }
  ]

  [ match
   { $mountTerminalView (
    ; to term !mountTerminalView $host-el $term-opts
    ; set $term modal.term
   ) }
  ]

  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   ; to mount-parent [ match
    { $document.body : $document.body }
    { $modal.host : $modal.host }
    { true : null }
   ]
   [ match
    { $mount-parent.appendChild : !mount-parent.appendChild $backdrop }
   ]
  )
  [ match
   { $modal.term.focus : !modal.term.focus }
  ]
  $modal
 )

 !ctrlc-btn.addEventListener click (
  [ match
   { $modal.term.sendCtrlC : !modal.term.sendCtrlC }
  ]
  [ match
   { $modal.term.focus : !modal.term.focus }
  ]
 )

 !copy-btn.addEventListener click (
  ; to txt [ match
   { $modal.term.getPlainText : !modal.term.getPlainText }
   { true : '' }
  ]
  [ match
   { $window.navigator.clipboard.writeText (
    !window.navigator.clipboard.writeText $txt
    ; set 'Copied!' copy-btn.textContent
   ) }
  ]
 )

 !kill-btn.addEventListener click (
  [ match
   { $killDeployTerminalSession (
    [ match
     { $modal.session-id : !killDeployTerminalSession $modal.session-id }
    ]
   ) }
  ]
 )

 !close-btn.addEventListener click : !modal.close false
 !done-btn.addEventListener click : !modal.close false
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } (
   ; to is-active [ match
    { [ propertyIs running modal.status ] : true }
    { [ propertyIs connecting modal.status ] : true }
    { true : false }
   ]
   ; condition { propertyIs false is-active } : !modal.close true
  )
 )

 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs true modal.is-open } (
     ; condition { propertyIs Escape ev.key } (
      ; to is-active [ match
       { [ propertyIs running modal.status ] : true }
       { [ propertyIs connecting modal.status ] : true }
       { true : false }
      ]
      ; condition { propertyIs false is-active } : !modal.close true
     )
    )
   )
  ) }
 ]

 $modal
)
$scope
