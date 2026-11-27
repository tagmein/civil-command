-- file lane-session-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a dedicated Sessions modal: streamlined Session Switcher & Manager (with collapsible Advanced Tab vs. Browser controls) and full-screen Session History Page
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-config-backdrop lane-session-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-config-modal lane-session-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-config-title-wrap title-wrap.className
 ; to heading-el !document.createElement div
 ; assign $heading-el { className lane-modal-title } { textContent Sessions }
 ; to subtitle-el !document.createElement div
 ; assign $subtitle-el { className lane-config-id } { textContent '' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 !title-wrap.appendChild $heading-el
 !title-wrap.appendChild $subtitle-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to error-el !document.createElement div
 ; assign $error-el { className lane-session-error } { textContent '' } { hidden true }

 -- Mode 1: Streamlined Session Switcher & Manager (with Advanced Tab vs. Browser tucked away)
 ; to session-body !document.createElement div
 ; assign $session-body { className lane-config-form } { hidden true }

 ; to active-field !document.createElement div
 ; set lane-config-field active-field.className
 ; to active-label !document.createElement div
 ; assign $active-label { className lane-config-label } { textContent 'Current Session' }
 ; to active-id-row !document.createElement div
 ; set lane-session-dir-row active-id-row.className
 ; to active-id-box !document.createElement div
 ; set lane-session-id-box active-id-box.className
 ; to copy-agent-btn !document.createElement button
 ; assign $copy-agent-btn { type button } { className 'lane-modal-action lane-config-reset-btn' } { textContent 'Copy Info' } { title 'Copy session & open lanes context for an agent' }
 !active-id-row.appendChild $active-id-box
 !active-id-row.appendChild $copy-agent-btn
 ; to active-dir-row !document.createElement div
 ; set lane-session-dir-row active-dir-row.className
 ; to active-dir-box !document.createElement div
 ; assign $active-dir-box { className lane-session-id-box } { textContent Default }
 ; to active-dir-btn !document.createElement button
 ; assign $active-dir-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent 'Choose / Confirm…' } { hidden true }
 !active-dir-row.appendChild $active-dir-box
 !active-dir-row.appendChild $active-dir-btn
 ; to rename-row !document.createElement div
 ; set lane-config-input-row rename-row.className
 ; to rename-input !document.createElement input
 ; assign $rename-input { type text } { className lane-config-input } { placeholder 'Session name...' } { spellcheck false } { autocomplete off }
 ; to rename-btn !document.createElement button
 ; assign $rename-btn { type button } { className 'lane-modal-action lane-config-reset-btn' } { textContent Rename }
 !rename-row.appendChild $rename-input
 !rename-row.appendChild $rename-btn
 !active-field.appendChild $active-label
 !active-field.appendChild $active-id-row
 !active-field.appendChild $active-dir-row
 !active-field.appendChild $rename-row

 ; to draft-field !document.createElement div
 ; assign $draft-field { className 'workspace-session-draft lane-session-draft-banner' } { hidden true }
 ; to draft-text !document.createElement div
 ; assign $draft-text { className 'workspace-session-draft-label lane-session-draft-text' } { textContent 'Unsaved version' }
 ; to draft-btns !document.createElement div
 ; set 'workspace-session-draft-actions lane-config-input-row' draft-btns.className
 ; to draft-save-btn !document.createElement button
 ; assign $draft-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
 ; to draft-fork-btn !document.createElement button
 ; assign $draft-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
 ; to draft-abandon-btn !document.createElement button
 ; assign $draft-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent Abandon }
 !draft-btns.appendChild $draft-save-btn
 !draft-btns.appendChild $draft-fork-btn
 !draft-btns.appendChild $draft-abandon-btn
 !draft-field.appendChild $draft-text
 !draft-field.appendChild $draft-btns

 ; to links-field !document.createElement div
 ; set lane-config-field links-field.className
 ; to links-label !document.createElement div
 ; assign $links-label { className lane-config-label } { textContent 'Session Navigation (Previous / Next)' }
 ; to links-grid !document.createElement div
 ; set lane-session-links-grid links-grid.className

 ; to prev-group !document.createElement div
 ; set lane-session-links-group prev-group.className
 ; to prev-hdr !document.createElement div
 ; set lane-session-links-header prev-hdr.className
 ; to prev-title !document.createElement span
 ; assign $prev-title { className lane-session-links-title } { textContent Previous }
 ; to prev-hint !document.createElement span
 ; assign $prev-hint { className lane-session-links-hint } { textContent 'Left rail' }
 !prev-hdr.appendChild $prev-title
 !prev-hdr.appendChild $prev-hint
 ; to prev-links-list !document.createElement div
 ; set lane-session-links-list prev-links-list.className
 ; to prev-add-row !document.createElement div
 ; set lane-config-input-row prev-add-row.className
 ; to prev-select !document.createElement select
 ; assign $prev-select { className lane-session-link-select }
 !prev-select.setAttribute aria-label 'Add previous session'
 ; to prev-add-btn !document.createElement button
 ; assign $prev-add-btn { type button } { className lane-modal-action } { textContent '+ Add' }
 !prev-add-row.appendChild $prev-select
 !prev-add-row.appendChild $prev-add-btn
 !prev-group.appendChild $prev-hdr
 !prev-group.appendChild $prev-links-list
 !prev-group.appendChild $prev-add-row

 ; to next-group !document.createElement div
 ; set lane-session-links-group next-group.className
 ; to next-hdr !document.createElement div
 ; set lane-session-links-header next-hdr.className
 ; to next-title !document.createElement span
 ; assign $next-title { className lane-session-links-title } { textContent Next }
 ; to next-hint !document.createElement span
 ; assign $next-hint { className lane-session-links-hint } { textContent 'Right rail' }
 !next-hdr.appendChild $next-title
 !next-hdr.appendChild $next-hint
 ; to next-links-list !document.createElement div
 ; set lane-session-links-list next-links-list.className
 ; to next-add-row !document.createElement div
 ; set lane-config-input-row next-add-row.className
 ; to next-select !document.createElement select
 ; assign $next-select { className lane-session-link-select }
 !next-select.setAttribute aria-label 'Add next session'
 ; to next-add-btn !document.createElement button
 ; assign $next-add-btn { type button } { className lane-modal-action } { textContent '+ Add' }
 !next-add-row.appendChild $next-select
 !next-add-row.appendChild $next-add-btn
 !next-group.appendChild $next-hdr
 !next-group.appendChild $next-links-list
 !next-group.appendChild $next-add-row

 !links-grid.appendChild $prev-group
 !links-grid.appendChild $next-group
 !links-field.appendChild $links-label
 !links-field.appendChild $links-grid

 ; to switch-field !document.createElement div
 ; set lane-config-field switch-field.className
 ; to switch-label !document.createElement label
 ; assign $switch-label { className lane-config-label } { textContent 'Open or Create Session' }
 ; to switch-input !document.createElement input
 ; assign $switch-input { type text } { className lane-config-input } { placeholder 'Enter existing session ID...' } { spellcheck false } { autocomplete off }
 ; to switch-actions !document.createElement div
 ; set lane-config-input-row switch-actions.className
 ; to switch-go-btn !document.createElement button
 ; assign $switch-go-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent 'Switch session' }
 ; to new-sess-btn !document.createElement button
 ; assign $new-sess-btn { type button } { className lane-modal-action } { textContent '+ New session' }
 ; to fork-sess-btn !document.createElement button
 ; assign $fork-sess-btn { type button } { className lane-modal-action } { textContent 'Fork current' }
 ; to open-hist-btn !document.createElement button
 ; assign $open-hist-btn { type button } { className lane-modal-action } { textContent 'History…' }
 !switch-actions.appendChild $switch-go-btn
 !switch-actions.appendChild $new-sess-btn
 !switch-actions.appendChild $fork-sess-btn
 !switch-actions.appendChild $open-hist-btn
 !switch-field.appendChild $switch-label
 !switch-field.appendChild $switch-input
 !switch-field.appendChild $switch-actions

 ; to recent-field !document.createElement div
 ; set lane-config-field recent-field.className
 ; to recent-label !document.createElement div
 ; assign $recent-label { className lane-config-label } { textContent 'Recent Sessions' }
 ; to recent-list !document.createElement div
 ; set lane-session-list recent-list.className
 !recent-field.appendChild $recent-label
 !recent-field.appendChild $recent-list

 -- Collapsible Advanced section: Tab vs. Browser session controls
 ; to adv-wrap !document.createElement div
 ; set lane-session-advanced adv-wrap.className
 ; to adv-toggle !document.createElement button
 ; assign $adv-toggle { type button } { className lane-session-advanced-toggle } { textContent '▸ Advanced (Tab vs. Browser Session)' }
 ; to adv-body !document.createElement div
 ; assign $adv-body { className lane-session-advanced-body } { hidden true }

 ; to browser-label !document.createElement div
 ; assign $browser-label { className lane-config-label } { textContent 'Browser Default Session (localStorage)' }
 ; to browser-id-box !document.createElement div
 ; set lane-session-id-box browser-id-box.className
 ; to override-actions !document.createElement div
 ; set lane-config-input-row override-actions.className
 ; to return-btn !document.createElement button
 ; assign $return-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent 'Return to browser session' }
 ; to promote-btn !document.createElement button
 ; assign $promote-btn { type button } { className lane-modal-action } { textContent 'Promote tab to browser' }
 !override-actions.appendChild $return-btn
 !override-actions.appendChild $promote-btn

 ; to adv-tab-actions !document.createElement div
 ; set lane-config-input-row adv-tab-actions.className
 ; to switch-tab-btn !document.createElement button
 ; assign $switch-tab-btn { type button } { className lane-modal-action } { textContent 'Open ID in tab only' }
 ; to new-tab-btn !document.createElement button
 ; assign $new-tab-btn { type button } { className lane-modal-action } { textContent 'New tab-only session' }
 !adv-tab-actions.appendChild $switch-tab-btn
 !adv-tab-actions.appendChild $new-tab-btn

 !adv-body.appendChild $browser-label
 !adv-body.appendChild $browser-id-box
 !adv-body.appendChild $override-actions
 !adv-body.appendChild $adv-tab-actions
 !adv-wrap.appendChild $adv-toggle
 !adv-wrap.appendChild $adv-body

 ; to session-footer !document.createElement div
 ; set lane-config-footer session-footer.className
 ; to session-done-btn !document.createElement button
 ; assign $session-done-btn { type button } { className 'lane-modal-action lane-config-btn--save' } { textContent Done }
 !session-footer.appendChild $session-done-btn

 !session-body.appendChild $active-field
 !session-body.appendChild $draft-field
 !session-body.appendChild $links-field
 !session-body.appendChild $switch-field
 !session-body.appendChild $recent-field
 !session-body.appendChild $adv-wrap
 !session-body.appendChild $session-footer

 -- Mode 2: Full-screen Session History Page (chronological log of when each session was active)
 ; to history-page !document.createElement div
 ; assign $history-page { className lane-page-body } { hidden true }

 ; to hist-toolbar !document.createElement div
 ; set lane-page-toolbar hist-toolbar.className
 ; to hist-search !document.createElement input
 ; assign $hist-search { type text } { className lane-modal-search } { placeholder 'Filter history by session name or ID...' } { spellcheck false } { autocomplete off }
 ; to hist-new-btn !document.createElement button
 ; assign $hist-new-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent '+ New session' }
 ; to hist-fork-btn !document.createElement button
 ; assign $hist-fork-btn { type button } { className lane-modal-action } { textContent 'Fork current' }
 !hist-toolbar.appendChild $hist-search
 !hist-toolbar.appendChild $hist-new-btn
 !hist-toolbar.appendChild $hist-fork-btn

 ; to hist-draft-field !document.createElement div
 ; assign $hist-draft-field { className workspace-session-draft } { hidden true }
 ; to hist-draft-text !document.createElement div
 ; assign $hist-draft-text { className workspace-session-draft-label } { textContent 'Unsaved version' }
 ; to hist-draft-btns !document.createElement div
 ; set workspace-session-draft-actions hist-draft-btns.className
 ; to hist-draft-save-btn !document.createElement button
 ; assign $hist-draft-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
 ; to hist-draft-fork-btn !document.createElement button
 ; assign $hist-draft-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
 ; to hist-draft-abandon-btn !document.createElement button
 ; assign $hist-draft-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent Abandon }
 !hist-draft-btns.appendChild $hist-draft-save-btn
 !hist-draft-btns.appendChild $hist-draft-fork-btn
 !hist-draft-btns.appendChild $hist-draft-abandon-btn
 !hist-draft-field.appendChild $hist-draft-text
 !hist-draft-field.appendChild $hist-draft-btns

 ; to hist-list !document.createElement div
 ; set lane-modal-list hist-list.className

 !history-page.appendChild $hist-toolbar
 !history-page.appendChild $hist-draft-field
 !history-page.appendChild $hist-list

 !panel.appendChild $header
 !panel.appendChild $error-el
 !panel.appendChild $session-body
 !panel.appendChild $history-page
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading-el }
  { subtitle-el $subtitle-el }
  { error-el $error-el }
  { close-btn $close-btn }
  { session-body $session-body }
  { active-id-box $active-id-box }
  { copy-agent-btn $copy-agent-btn }
  { copy-timer null }
  { active-dir-row $active-dir-row }
  { active-dir-box $active-dir-box }
  { active-dir-btn $active-dir-btn }
  { rename-input $rename-input }
  { rename-btn $rename-btn }
  { draft-field $draft-field }
  { draft-text $draft-text }
  { draft-btns $draft-btns }
  { draft-save-btn $draft-save-btn }
  { draft-fork-btn $draft-fork-btn }
  { draft-abandon-btn $draft-abandon-btn }
  { links-field $links-field }
  { prev-links-list $prev-links-list }
  { prev-select $prev-select }
  { prev-add-btn $prev-add-btn }
  { prev-link-els {} }
  { prev-link-items {} }
  { prev-opt-els {} }
  { next-links-list $next-links-list }
  { next-select $next-select }
  { next-add-btn $next-add-btn }
  { next-link-els {} }
  { next-link-items {} }
  { next-opt-els {} }
  { switch-input $switch-input }
  { switch-go-btn $switch-go-btn }
  { new-sess-btn $new-sess-btn }
  { fork-sess-btn $fork-sess-btn }
  { open-hist-btn $open-hist-btn }
  { recent-list $recent-list }
  { adv-toggle $adv-toggle }
  { adv-body $adv-body }
  { adv-open false }
  { browser-id-box $browser-id-box }
  { override-actions $override-actions }
  { return-btn $return-btn }
  { promote-btn $promote-btn }
  { switch-tab-btn $switch-tab-btn }
  { new-tab-btn $new-tab-btn }
  { session-done-btn $session-done-btn }
  { history-page $history-page }
  { hist-search $hist-search }
  { hist-new-btn $hist-new-btn }
  { hist-fork-btn $hist-fork-btn }
  { hist-draft-field $hist-draft-field }
  { hist-draft-text $hist-draft-text }
  { hist-draft-btns $hist-draft-btns }
  { hist-draft-save-btn $hist-draft-save-btn }
  { hist-draft-fork-btn $hist-draft-fork-btn }
  { hist-draft-abandon-btn $hist-draft-abandon-btn }
  { hist-list $hist-list }
  { hist-query '' }
  { hist-els {} }
  { hist-items {} }
  { is-open false }
  { mode session }
  { recent-els {} }
  { recent-items {} }
 ]

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

 ; to show-mode (
  ; to { next-mode title sub } $argv
  ; set $next-mode modal.mode
  ; set $title heading-el.textContent
  ; set $sub subtitle-el.textContent
  !set-error ''
  ; to is-wide [ propertyIs history next-mode ]
  ; set [ ternary $is-wide 'lane-modal-backdrop lane-session-backdrop lane-session-backdrop--wide' 'lane-modal-backdrop lane-config-backdrop lane-session-backdrop' ] backdrop.className
  ; set [ ternary $is-wide 'lane-modal lane-session-modal lane-session-modal--wide' 'lane-modal lane-config-modal lane-session-modal' ] panel.className
  ; set [ ternary [ propertyIs session next-mode ] false true ] session-body.hidden
  ; set [ ternary [ propertyIs history next-mode ] false true ] history-page.hidden
  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   [ match
    { $document.body.appendChild : !document.body.appendChild $backdrop }
   ]
  )
 )

 ; to modal.close (
  -- Closes the session modal
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   !set-error ''
   !backdrop.remove
  )
 )

 ; to render-link-group (
  -- Renders a Previous or Next destination list and its available-session selector
  ; to { direction resolved-list linked-ids available-sessions list-el select-el add-btn els-store items-store opt-els-store } $argv
  ; while { propertyIsGreaterThan 0 els-store.length } (
   ; to old !els-store.pop
   !old.remove
  )
  ; set 0 items-store.length

  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; to dirty [ and { propertyIs false pending } { propertyIs true lane-control.session-dirty } ]
  ; to blocked [ match { $pending : true } { $dirty : true } { true : false } ]
  ; to pending-lbl [ match
   { [ propertyIs '' lane-control.session-status-label ] : 'Loading…' }
   { $lane-control.session-status-label : $lane-control.session-status-label }
   { true : 'Loading…' }
  ]
  ; to items [ match { $resolved-list : $resolved-list } { true : {} } ]
  [ match
   { [ propertyIs 0 items.length ] (
    ; to empty-el !document.createElement div
    ; to empty-msg [ ternary [ propertyIs previous direction ] 'No previous sessions linked.' 'No next sessions linked.' ]
    ; assign $empty-el { className lane-session-links-empty } { textContent $empty-msg }
    !list-el.appendChild $empty-el
    !els-store.push $empty-el
   ) }
   { true (
    ; each $items (
     ; to { item } $argv
     ; to is-avail [ propertyIs true item.available ]
     ; to can-go [ and { propertyIs true is-avail } { propertyIs false blocked } ]
     ; to row !document.createElement div
     ; set [ ternary $is-avail lane-session-link-row 'lane-session-link-row lane-session-link-row--unavailable' ] row.className
     ; to go-btn !document.createElement button
     ; to display-name [ match { $item.name : $item.name } { true : $item.id } ]
     ; to go-title [ match
      { [ propertyIs false is-avail ] : ; add 'Session ' ; add $item.id ' is no longer available' }
      { $pending : ; add $pending-lbl ; add ' — wait before switching to ' ; add $display-name ; add ' (' ; add $item.id ')' }
      { $dirty : ; add 'Resolve unsaved version (Save, Fork, or Abandon) before switching to ' ; add $display-name ; add ' (' ; add $item.id ')' }
      { true : ; add 'Switch to ' ; add $display-name ; add ' (' ; add $item.id ')' }
     ]
     ; assign $go-btn { type button } { className lane-session-link-go } { textContent $display-name } { title $go-title } { disabled [ ternary $can-go false true ] }
     !go-btn.setAttribute aria-disabled [ ternary $can-go 'false' 'true' ]
     [ match
      { $is-avail (
       !go-btn.addEventListener click (
        ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
         !lane-control.switch-session $item.id
         !modal.close
        )
       )
      ) }
     ]
     !row.appendChild $go-btn
     [ match
      { [ propertyIs false is-avail ] (
       ; to badge !document.createElement span
       ; assign $badge { className lane-session-link-badge } { textContent Unavailable }
       !row.appendChild $badge
      ) }
     ]
     ; to rem-btn !document.createElement button
     ; assign $rem-btn { type button } { className lane-session-link-remove } { textContent '×' } { title [ ; add 'Remove ' $display-name ] }
     !rem-btn.setAttribute aria-label [ ; add 'Remove ' $display-name ]
     !rem-btn.addEventListener click (
      [ match
       { [ propertyIs previous direction ] : !lane-control.remove-previous-session $item.id }
       { true : !lane-control.remove-next-session $item.id }
      ]
      !modal.render-session
     )
     !row.appendChild $rem-btn
     !list-el.appendChild $row
     !els-store.push $row
     !items-store.push ; object { item $item } { el $row } { go-btn $go-btn } { remove-btn $rem-btn }
    )
   ) }
  ]

  ; while { propertyIsGreaterThan 0 opt-els-store.length } (
   ; to old-opt !opt-els-store.pop
   !old-opt.remove
  )
  ; to existing-ids [ match { $linked-ids : $linked-ids } { true : {} } ]
  ; to candidates {}
  ; each $available-sessions (
   ; to { cand } $argv
   ; to already [ !existing-ids.includes $cand.id ]
   ; condition { propertyIs false already } : !candidates.push $cand
  )
  [ match
   { [ propertyIs 0 candidates.length ] (
    ; to placeholder !document.createElement option
    ; assign $placeholder { value '' } { textContent 'No other available sessions' } { disabled true }
    !select-el.appendChild $placeholder
    !opt-els-store.push $placeholder
    ; set '' select-el.value
    ; set true select-el.disabled
    ; set true add-btn.disabled
   ) }
   { true (
    ; to first-val ; object { id '' }
    ; each $candidates (
     ; to { cand idx } $argv
     ; to opt !document.createElement option
     ; to cand-name [ match { $cand.name : $cand.name } { true : $cand.id } ]
     ; to opt-label ; add $cand-name ; add ' (' ; add $cand.id ')'
     ; assign $opt { value $cand.id } { textContent $opt-label }
     !select-el.appendChild $opt
     !opt-els-store.push $opt
     ; condition { propertyIs 0 idx } : ; set $cand.id first-val.id
    )
    ; set $first-val.id select-el.value
    ; set false select-el.disabled
    ; set false add-btn.disabled
   ) }
  ]
 )

 ; to modal.render-session (
  -- Renders streamlined Session Switcher & Manager with collapsible Advanced tab/browser controls
  !lane-control.ensure-session
  [ match
   { $lane-control.refresh-session-links : !lane-control.refresh-session-links }
  ]
  ; to available-sessions [ match
   { $lane-control.list-available-sessions : !lane-control.list-available-sessions }
   { true : {} }
  ]
  !render-link-group previous $lane-control.resolved-previous-sessions $lane-control.previous-session-ids $available-sessions $prev-links-list $prev-select $prev-add-btn $modal.prev-link-els $modal.prev-link-items $modal.prev-opt-els
  !render-link-group next $lane-control.resolved-next-sessions $lane-control.next-session-ids $available-sessions $next-links-list $next-select $next-add-btn $modal.next-link-els $modal.next-link-items $modal.next-opt-els
  ; to cur-id $lane-control.session-id
  ; to browser-id $lane-control.browser-session-id
  ; to overridden [ propertyIs true lane-control.session-overridden ]
  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; to dirty [ and { propertyIs false pending } { propertyIs true lane-control.session-dirty } ]
  ; to blocked [ match { $pending : true } { $dirty : true } { true : false } ]
  ; to pending-lbl [ match
   { [ propertyIs '' lane-control.session-status-label ] : 'Loading…' }
   { $lane-control.session-status-label : $lane-control.session-status-label }
   { true : 'Loading…' }
  ]
  ; to cur-name [ match
   { $lane-control.session-meta.name : $lane-control.session-meta.name }
   { true : $cur-id }
  ]
  ; to ver [ match
   { $lane-control.session-meta.version : ; add 'v' $lane-control.session-meta.version }
   { true : v1 }
  ]
  ; to id-txt ; add $cur-id ; add ' · ' $ver
  ; set [ match { $overridden : ; add $id-txt ' (tab override)' } { true : $id-txt } ] active-id-box.textContent
  ; to dirs-disabled [ match
   { $lane-control.is-session-dirs-disabled : !lane-control.is-session-dirs-disabled }
   { [ propertyIs true lane-control.session-dirs-disabled ] : true }
   { true : false }
  ]
  ; to dir-confirmed [ propertyIs true lane-control.session-data-dir-confirmed ]
  ; to dir-label [ match
   { $lane-control.format-data-dir-label : !lane-control.format-data-dir-label $lane-control.session-data-dir $dir-confirmed }
   { $lane-control.session-data-dir : $lane-control.session-data-dir }
   { [ propertyIs true dir-confirmed ] : Default }
   { true : 'Default (unconfirmed)' }
  ]
  ; to dir-display [ match
   { $dir-confirmed : ; add 'Data Directory (permanent): ' $dir-label }
   { true : ; add 'Data Directory: ' $dir-label }
  ]
  ; set $dir-display active-dir-box.textContent
  ; set $dir-label active-dir-box.title
  ; set $dirs-disabled active-dir-row.hidden
  ; set [ match { $dirs-disabled : true } { true : $dir-confirmed } ] active-dir-btn.hidden
  ; set $cur-name rename-input.value
  ; set [ ternary $blocked false true ] draft-field.hidden
  ; set [ ternary $pending 'workspace-session-draft workspace-session-draft--pending lane-session-draft-banner' 'workspace-session-draft lane-session-draft-banner' ] draft-field.className
  ; set [ ternary $pending $pending-lbl 'Unsaved version' ] draft-text.textContent
  ; set $pending draft-btns.hidden
  ; set $blocked switch-input.disabled
  ; set $blocked switch-go-btn.disabled
  ; set $blocked new-sess-btn.disabled
  ; set $blocked return-btn.disabled
  ; set $blocked switch-tab-btn.disabled
  ; set $blocked new-tab-btn.disabled
  ; set $browser-id browser-id-box.textContent
  ; set [ ternary $overridden false true ] override-actions.hidden

  ; while { propertyIsGreaterThan 0 modal.recent-els.length } (
   ; to old !modal.recent-els.pop
   !old.remove
  )
  ; set 0 modal.recent-items.length

  ; each $lane-control.recent-sessions (
   ; to { rec } $argv
   ; to row !document.createElement div
   ; set lane-session-item row.className
   ; to info !document.createElement div
   ; set lane-modal-item-info info.className
   ; to nm !document.createElement div
   ; to rec-name [ match { $rec.name : $rec.name } { true : $rec.id } ]
   ; assign $nm { className lane-modal-item-title } { textContent $rec-name }
   ; to id-sub !document.createElement div
   ; assign $id-sub { className lane-modal-item-id } { textContent $rec.id }
   ; to rec-dir [ match
    { $lane-control.format-data-dir-label : !lane-control.format-data-dir-label $rec.dataDir $rec.dataDirConfirmed }
    { $rec.dataDir : $rec.dataDir }
    { [ propertyIs true rec.dataDirConfirmed ] : Default }
    { true : 'Default (unconfirmed)' }
   ]
   ; to dir-sub !document.createElement div
   ; assign $dir-sub { className lane-session-item-dir } { textContent [ ; add 'Dir: ' $rec-dir ] } { title $rec-dir }
   !info.appendChild $nm
   !info.appendChild $id-sub
   ; condition { propertyIs false dirs-disabled } : !info.appendChild $dir-sub

   ; to acts !document.createElement div
   ; set lane-modal-item-actions acts.className
   ; to is-cur [ propertyIs $cur-id rec.id ]
   [ match
    { $is-cur (
     ; to cur-badge !document.createElement span
     ; assign $cur-badge { className 'lane-modal-badge lane-modal-badge--selected' } { textContent Active }
     !acts.appendChild $cur-badge
    ) }
    { true (
     ; to sw-btn !document.createElement button
     ; assign $sw-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Switch } { disabled $blocked }
     !sw-btn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
     !sw-btn.addEventListener click (
      ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
       !lane-control.switch-session $rec.id
       !modal.close
      )
     )
     !acts.appendChild $sw-btn
     [ match
      { $modal.adv-open (
       ; to tab-btn !document.createElement button
       ; assign $tab-btn { type button } { className lane-modal-action } { textContent 'Tab only' } { disabled $blocked }
       !tab-btn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
       !tab-btn.addEventListener click (
        ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
         !lane-control.switch-tab-session $rec.id
         !modal.render-session
        )
       )
       !acts.appendChild $tab-btn
      ) }
     ]
    ) }
   ]
   !row.appendChild $info
   !row.appendChild $acts
   !recent-list.appendChild $row
   !modal.recent-els.push $row
   !modal.recent-items.push ; object { rec $rec } { el $row } { switch-btn [ match { $is-cur : null } { true : $sw-btn } ] }
  )
 )

 ; to modal.render-history-page (
  -- Renders the full-screen Session History Page with chronological activation times and 1-click switching
  !lane-control.ensure-session
  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; to dirty [ and { propertyIs false pending } { propertyIs true lane-control.session-dirty } ]
  ; to blocked [ match { $pending : true } { $dirty : true } { true : false } ]
  ; to pending-lbl [ match
   { [ propertyIs '' lane-control.session-status-label ] : 'Loading…' }
   { $lane-control.session-status-label : $lane-control.session-status-label }
   { true : 'Loading…' }
  ]
  ; set [ ternary $blocked false true ] hist-draft-field.hidden
  ; set [ ternary $pending 'workspace-session-draft workspace-session-draft--pending' workspace-session-draft ] hist-draft-field.className
  ; set [ ternary $pending $pending-lbl 'Unsaved version' ] hist-draft-text.textContent
  ; set $pending hist-draft-btns.hidden
  ; set $blocked hist-new-btn.disabled
  ; while { propertyIsGreaterThan 0 modal.hist-els.length } (
   ; to old !modal.hist-els.pop
   !old.remove
  )
  ; set 0 modal.hist-items.length

  ; to dirs-disabled [ match
   { $lane-control.is-session-dirs-disabled : !lane-control.is-session-dirs-disabled }
   { [ propertyIs true lane-control.session-dirs-disabled ] : true }
   { true : false }
  ]
  ; to entries !readSessionHistory $window
  ; to q-trimmed !modal.hist-query.trim
  ; to q !q-trimmed.toLowerCase
  ; to matches {}
  ; each $entries (
   ; to { item } $argv
   ; to dir-str [ match
    { $dirs-disabled : '' }
    { $item.dataDir : $item.dataDir }
    { true : Default }
   ]
   ; to hay-raw ; add $item.sessionName ; add ' ' ; add $item.sessionId ; add ' ' $dir-str
   ; to hay !hay-raw.toLowerCase
   ; to hit [ match
    { [ propertyIs '' q ] : true }
    { [ !hay.includes $q ] : true }
    { true : false }
   ]
   [ match
    { $hit : !matches.push $item }
   ]
  )

  [ match
   { [ propertyIs 0 matches.length ] (
    ; to empty-h !document.createElement div
    ; assign $empty-h { className lane-modal-empty } { textContent 'No session history recorded yet.' }
    !hist-list.appendChild $empty-h
    !modal.hist-els.push $empty-h
   ) }
   { true (
    ; to ts-opts [ match
     { $lane-control.get-clock-display-options : !lane-control.get-clock-display-options }
     { true (
      ; to fb-tz [ match { $getBrowserTimeZone : !getBrowserTimeZone $window.Intl } { true : UTC } ]
      ; to fb-hr [ match { $lane-control.clock-hour-format : $lane-control.clock-hour-format } { true : '12h' } ]
      [ object { timeZone $fb-tz } { hourFormat $fb-hr } { showTimeZone true } { intl $window.Intl } ]
     ) }
    ]
    ; each $matches (
     ; to { entry } $argv
     ; to row !document.createElement div
     ; set lane-modal-item row.className
     ; to info !document.createElement div
     ; set lane-modal-item-info info.className
     ; to nm !document.createElement div
     ; assign $nm { className lane-modal-item-title } { textContent $entry.sessionName }
     ; to start-fmt !formatLineTimestamp $entry.startedAt $ts-opts
     ; to dur-txt !formatSessionDuration $entry.startedAt $entry.endedAt
     ; to time-txt [ match
      { $entry.endedAt (
       ; to end-fmt !formatLineTimestamp $entry.endedAt $ts-opts
       ; add $start-fmt.display ; add ' – ' ; add $end-fmt.display ; add ' (' ; add $dur-txt ')'
      ) }
      { true : ; add $start-fmt.display ' · Active now' }
     ]
     ; to time-el !document.createElement div
     ; assign $time-el { className lane-history-time } { textContent $time-txt }
     ; to dir-lbl [ match
      { $lane-control.format-data-dir-label : !lane-control.format-data-dir-label $entry.dataDir $entry.dataDirConfirmed }
      { $entry.dataDir : $entry.dataDir }
      { [ propertyIs true entry.dataDirConfirmed ] : Default }
      { true : 'Default (unconfirmed)' }
     ]
     ; to dir-el !document.createElement div
     ; assign $dir-el { className lane-history-dir } { textContent [ ; add 'Dir: ' $dir-lbl ] } { title $dir-lbl }
     ; to sub-el !document.createElement div
     ; to sub-txt ; add $entry.sessionId ; add ' · ' ; add $entry.laneCount ' lanes'
     ; assign $sub-el { className lane-modal-item-id } { textContent $sub-txt }
     !info.appendChild $nm
     !info.appendChild $time-el
     ; condition { propertyIs false dirs-disabled } : !info.appendChild $dir-el
     !info.appendChild $sub-el

     ; to acts !document.createElement div
     ; set lane-modal-item-actions acts.className
     ; to is-cur [ propertyIs $lane-control.session-id entry.sessionId ]
     [ match
      { $is-cur (
       ; to cur-badge !document.createElement span
       ; assign $cur-badge { className 'lane-modal-badge lane-modal-badge--selected' } { textContent Active }
       !acts.appendChild $cur-badge
      ) }
      { true (
       ; to sw-btn !document.createElement button
       ; assign $sw-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Switch } { disabled $blocked }
       !sw-btn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
       !sw-btn.addEventListener click (
        ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
         !lane-control.switch-session $entry.sessionId
         !modal.close
        )
       )
       !acts.appendChild $sw-btn
      ) }
     ]
     !row.appendChild $info
     !row.appendChild $acts
     !hist-list.appendChild $row
     !modal.hist-els.push $row
     !modal.hist-items.push ; object { entry $entry } { el $row } { switch-btn [ match { $is-cur : null } { true : $sw-btn } ] }
    )
   ) }
  ]
 )

 ; to modal.open-switch-session (
  -- Opens the streamlined Session Switcher & Manager modal
  ; set '' switch-input.value
  !show-mode session Sessions 'Switch, rename, fork, or manage your active session'
  !modal.render-session
  ; set 'Copy Info' copy-agent-btn.textContent
  $modal
 )

 ; to modal.open-history (
  -- Opens the full-screen Session History Page modal
  ; set '' modal.hist-query
  ; set '' hist-search.value
  !show-mode history 'Session History' 'Activity log of when each session was active — click Switch to jump back in'
  !modal.render-history-page
  [ match
   { $hist-search.focus : !hist-search.focus }
  ]
  $modal
 )

 !active-dir-btn.addEventListener click (
  !modal.close
  ; to dirs-disabled [ match
   { $lane-control.is-session-dirs-disabled : !lane-control.is-session-dirs-disabled }
   { [ propertyIs true lane-control.session-dirs-disabled ] : true }
   { true : false }
  ]
  [ match
   { [ and { propertyIs false dirs-disabled } { $lane-control.dir-modal.open-confirm } ] : !lane-control.dir-modal.open-confirm }
  ]
 )
 !copy-agent-btn.addEventListener click (
  [ match
   { $lane-control.copy-agent-context : !lane-control.copy-agent-context }
  ]
  ; set Copied copy-agent-btn.textContent
  [ match
   { $window.setTimeout (
    [ match
     { $modal.copy-timer : !window.clearTimeout $modal.copy-timer }
    ]
    ; to next-timer !window.setTimeout (
     ; set 'Copy Info' copy-agent-btn.textContent
     ; set null modal.copy-timer
    ) 1200
    ; set $next-timer modal.copy-timer
   ) }
  ]
 )
 !rename-btn.addEventListener click (
  ; to next-name !rename-input.value.trim
  ; condition { propertyIsGreaterThan 0 next-name.length } (
   !lane-control.rename-session $next-name
   !modal.render-session
  )
 )
 !draft-save-btn.addEventListener click (
  !lane-control.save-session-draft
  !modal.render-session
 )
 !draft-fork-btn.addEventListener click (
  !lane-control.fork-session
  !modal.render-session
 )
 !draft-abandon-btn.addEventListener click (
  !lane-control.abandon-session-draft
  !modal.render-session
 )
 !prev-add-btn.addEventListener click (
  ; to chosen !prev-select.value.trim
  ; condition { propertyIsGreaterThan 0 chosen.length } (
   !lane-control.add-previous-session $chosen
   !modal.render-session
  )
 )
 !next-add-btn.addEventListener click (
  ; to chosen !next-select.value.trim
  ; condition { propertyIsGreaterThan 0 chosen.length } (
   !lane-control.add-next-session $chosen
   !modal.render-session
  )
 )
 !switch-go-btn.addEventListener click (
  ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
   ; to target-id !switch-input.value.trim
   [ match
    { [ propertyIs '' target-id ] : !set-error 'Enter a session ID to switch to' }
    { true (
     !set-error ''
     !lane-control.switch-session $target-id
     ; set '' switch-input.value
     !modal.close
    ) }
   ]
  )
 )
 !new-sess-btn.addEventListener click (
  ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
   !set-error ''
   !modal.close
   [ match
    { $lane-control.prompt-new-session : !lane-control.prompt-new-session false }
    { true : !lane-control.new-session }
   ]
  )
 )
 !fork-sess-btn.addEventListener click (
  !set-error ''
  !lane-control.fork-session
  !modal.close
 )
 !open-hist-btn.addEventListener click : !modal.open-history

 !adv-toggle.addEventListener click (
  ; to next-open [ ternary $modal.adv-open false true ]
  ; set $next-open modal.adv-open
  ; set [ ternary $next-open false true ] adv-body.hidden
  ; set [ ternary $next-open '▾ Advanced (Tab vs. Browser Session)' '▸ Advanced (Tab vs. Browser Session)' ] adv-toggle.textContent
  !modal.render-session
 )
 !return-btn.addEventListener click (
  ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
   !lane-control.return-to-browser-session
   !modal.render-session
  )
 )
 !promote-btn.addEventListener click (
  !lane-control.promote-tab-session
  !modal.render-session
 )
 !switch-tab-btn.addEventListener click (
  ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
   ; to target-id !switch-input.value.trim
   [ match
    { [ propertyIs '' target-id ] : !set-error 'Enter a session ID to open in this tab' }
    { true (
     !set-error ''
     !lane-control.switch-tab-session $target-id
     ; set '' switch-input.value
     !modal.render-session
    ) }
   ]
  )
 )
 !new-tab-btn.addEventListener click (
  ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
   !set-error ''
   !modal.close
   [ match
    { $lane-control.prompt-new-session : !lane-control.prompt-new-session true }
    { true : (
     !lane-control.new-tab-session
     !modal.render-session
    ) }
   ]
  )
 )

 !hist-draft-save-btn.addEventListener click (
  !lane-control.save-session-draft
  !modal.render-history-page
 )
 !hist-draft-fork-btn.addEventListener click (
  !lane-control.fork-session
  !modal.render-history-page
 )
 !hist-draft-abandon-btn.addEventListener click (
  !lane-control.abandon-session-draft
  !modal.render-history-page
 )
 !hist-search.addEventListener input (
  ; set $hist-search.value modal.hist-query
  !modal.render-history-page
 )
 !hist-new-btn.addEventListener click (
  ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
   !modal.close
   [ match
    { $lane-control.prompt-new-session : !lane-control.prompt-new-session false }
    { true : !lane-control.new-session }
   ]
  )
 )
 !hist-fork-btn.addEventListener click (
  !lane-control.fork-session
  !modal.close
 )

 !close-btn.addEventListener click $modal.close
 !session-done-btn.addEventListener click $modal.close
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