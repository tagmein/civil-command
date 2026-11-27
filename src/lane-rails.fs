-- file lane-rails.fs
; to scope ; object
; to scope.create (
 -- Creates always-open fixed top, left, and right rails and a floating non-interactive hover preview for minimized lanes
 ; to { lane-control } $argv
 ; to fs-enter-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--fullscreen-enter" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M1.5 3.5V1.5H3.5M6.5 1.5H8.5V3.5M8.5 6.5V8.5H6.5M3.5 8.5H1.5V6.5"></path></svg>'
 ; to fs-exit-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--fullscreen-exit" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M1.5 3.5H3.5V1.5M6.5 1.5V3.5H8.5M8.5 6.5H6.5V8.5M3.5 8.5V6.5H1.5"></path></svg>'
 ; to search-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--search" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4.25" cy="4.25" r="2.5"></circle><path d="M6.05 6.05L8.6 8.6"></path></svg>'
 ; to session-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--session" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="2.75" cy="2.5" r="1.25"></circle><circle cx="7.25" cy="2.5" r="1.25"></circle><circle cx="2.75" cy="7.5" r="1.25"></circle><path d="M2.75 3.75V6.25M7.25 3.75C7.25 5.3 5.5 5.5 2.75 5.5"></path></svg>'
 ; to packages-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--packages" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 1.4L8.5 3.2L5 5L1.5 3.2Z"></path><path d="M1.5 5L5 6.8L8.5 5"></path><path d="M1.5 6.8L5 8.6L8.5 6.8"></path></svg>'
 ; to servers-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--servers" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="2.6" rx="0.6"></rect><rect x="1.5" y="5.9" width="7" height="2.6" rx="0.6"></rect><circle cx="3" cy="2.8" r="0.45" fill="currentColor" stroke="none"></circle><circle cx="3" cy="7.2" r="0.45" fill="currentColor" stroke="none"></circle></svg>'
 ; to wrench-svg '<svg class="top-rail-icon-svg top-rail-icon-svg--preferences" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M8.6 3.3A2.1 2.1 0 0 1 5.7 5.5L2.5 8.7A0.85 0.85 0 0 1 1.3 7.5L4.5 4.3A2.1 2.1 0 0 1 6.7 1.4L5.6 2.5L7.5 4.4Z"></path></svg>'
 ; to prev-arrow-svg '<svg class="side-rail-nav-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 2.5L4 6L7.5 9.5"></path></svg>'
 ; to next-arrow-svg '<svg class="side-rail-nav-arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 2.5L8 6L4.5 9.5"></path></svg>'
 ; to restore-right-svg '<svg class="side-rail-restore-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9"></path></svg>'
 ; to restore-left-svg '<svg class="side-rail-restore-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 6H2.5M5.5 3L2.5 6L5.5 9"></path></svg>'

 ; to top-rail !document.createElement aside
 ; set top-rail top-rail.className
 !top-rail.setAttribute role region
 !top-rail.setAttribute aria-label 'Top command rail'

 ; to fullscreen-btn !document.createElement button
 ; assign $fullscreen-btn { type button } { className 'top-rail-icon top-rail-icon--fullscreen' } { textContent '' }

 ; to search-btn !document.createElement button
 ; assign $search-btn { type button } { className 'top-rail-icon top-rail-icon--search' } { textContent '' } { title 'Open lane' } { innerHTML $search-svg }
 !search-btn.setAttribute aria-label 'Open lane'

 ; to session-btn !document.createElement button
 ; assign $session-btn { type button } { className 'top-rail-icon top-rail-icon--session' } { textContent '' } { title Sessions } { innerHTML $session-svg }
 !session-btn.setAttribute aria-label Sessions
 !session-btn.setAttribute aria-haspopup menu
 !session-btn.setAttribute aria-expanded 'false'

 ; to packages-btn !document.createElement button
 ; assign $packages-btn { type button } { className 'top-rail-icon top-rail-icon--packages' } { textContent '' } { title Packages } { innerHTML $packages-svg }
 !packages-btn.setAttribute aria-label Packages
 !packages-btn.setAttribute aria-haspopup menu
 !packages-btn.setAttribute aria-expanded 'false'

 ; to servers-btn !document.createElement button
 ; assign $servers-btn { type button } { className 'top-rail-icon top-rail-icon--servers' } { textContent '' } { title 'Servers & Deployments' } { innerHTML $servers-svg }
 !servers-btn.setAttribute aria-label 'Servers & Deployments'

 ; to preferences-btn !document.createElement button
 ; assign $preferences-btn { type button } { className 'top-rail-icon top-rail-icon--preferences' } { textContent '' } { title Preferences } { innerHTML $wrench-svg }
 !preferences-btn.setAttribute aria-label Preferences
 !preferences-btn.setAttribute aria-haspopup menu
 !preferences-btn.setAttribute aria-expanded 'false'

 ; to clock-btn !document.createElement button
 ; assign $clock-btn { type button } { className 'top-rail-chip top-rail-clock' } { textContent '' } { title 'Current time & timezone' }
 !clock-btn.setAttribute aria-label 'Current time and timezone'
 !clock-btn.setAttribute aria-haspopup dialog
 !clock-btn.setAttribute aria-expanded 'false'

 !top-rail.appendChild $fullscreen-btn
 !top-rail.appendChild $search-btn
 !top-rail.appendChild $session-btn
 !top-rail.appendChild $packages-btn
 !top-rail.appendChild $servers-btn
 !top-rail.appendChild $preferences-btn
 !top-rail.appendChild $clock-btn

 ; to session-menu !document.createElement div
 ; assign $session-menu { className 'top-rail-menu top-rail-menu--session' } { hidden true }
 !session-menu.setAttribute role menu
 !session-menu.setAttribute aria-label 'Sessions menu'

 ; to session-status-el !document.createElement div
 ; assign $session-status-el { className top-rail-menu-status } { textContent 'Session' }

 ; to session-dir-el !document.createElement button
 ; assign $session-dir-el { type button } { className top-rail-menu-dir } { textContent Default }

 ; to session-draft-row !document.createElement div
 ; assign $session-draft-row { className workspace-session-draft } { hidden true }
 ; to session-draft-label !document.createElement div
 ; assign $session-draft-label { className workspace-session-draft-label } { textContent 'Unsaved version' }
 ; to session-draft-actions !document.createElement div
 ; set workspace-session-draft-actions session-draft-actions.className
 ; to session-save-btn !document.createElement button
 ; assign $session-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
 ; to session-draft-fork-btn !document.createElement button
 ; assign $session-draft-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
 ; to session-abandon-btn !document.createElement button
 ; assign $session-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent Abandon }
 !session-draft-actions.appendChild $session-save-btn
 !session-draft-actions.appendChild $session-draft-fork-btn
 !session-draft-actions.appendChild $session-abandon-btn
 !session-draft-row.appendChild $session-draft-label
 !session-draft-row.appendChild $session-draft-actions

 ; to session-new-btn !document.createElement button
 ; assign $session-new-btn { type button } { className 'top-rail-menu-item top-rail-menu-item--primary' } { textContent '+ New session' }
 !session-new-btn.setAttribute role menuitem

 ; to session-fork-btn !document.createElement button
 ; assign $session-fork-btn { type button } { className top-rail-menu-item } { textContent 'Fork current session' }
 !session-fork-btn.setAttribute role menuitem

 ; to session-manage-btn !document.createElement button
 ; assign $session-manage-btn { type button } { className top-rail-menu-item } { textContent 'Open / switch session…' }
 !session-manage-btn.setAttribute role menuitem

 ; to session-history-btn !document.createElement button
 ; assign $session-history-btn { type button } { className top-rail-menu-item } { textContent 'Session history…' }
 !session-history-btn.setAttribute role menuitem

 ; to session-copy-btn !document.createElement button
 ; assign $session-copy-btn { type button } { className top-rail-menu-item } { textContent 'Copy session info for agent' }
 !session-copy-btn.setAttribute role menuitem

 ; to session-recent-div !document.createElement div
 ; assign $session-recent-div { className top-rail-menu-divider } { hidden true }

 ; to session-recent-title !document.createElement div
 ; assign $session-recent-title { className top-rail-menu-section-title } { textContent 'Switch session' } { hidden true }

 ; to session-recent-el !document.createElement div
 ; set top-rail-menu-pkgs session-recent-el.className

 !session-menu.appendChild $session-status-el
 !session-menu.appendChild $session-dir-el
 !session-menu.appendChild $session-draft-row
 !session-menu.appendChild $session-new-btn
 !session-menu.appendChild $session-fork-btn
 !session-menu.appendChild $session-manage-btn
 !session-menu.appendChild $session-history-btn
 !session-menu.appendChild $session-copy-btn
 !session-menu.appendChild $session-recent-div
 !session-menu.appendChild $session-recent-title
 !session-menu.appendChild $session-recent-el

 ; to packages-menu !document.createElement div
 ; assign $packages-menu { className 'top-rail-menu top-rail-menu--packages' } { hidden true }
 !packages-menu.setAttribute role menu
 !packages-menu.setAttribute aria-label 'Packages menu'

 ; to pkg-menu-title !document.createElement div
 ; assign $pkg-menu-title { className top-rail-menu-section-title } { textContent 'Included packages' }

 ; to pkg-menu-list !document.createElement div
 ; set top-rail-menu-pkgs pkg-menu-list.className

 ; to pkg-menu-div !document.createElement div
 ; set top-rail-menu-divider pkg-menu-div.className

 ; to pkg-create-btn !document.createElement button
 ; assign $pkg-create-btn { type button } { className 'top-rail-menu-item top-rail-menu-item--primary' } { textContent '+ Create package…' }
 !pkg-create-btn.setAttribute role menuitem

 ; to pkg-open-btn !document.createElement button
 ; assign $pkg-open-btn { type button } { className top-rail-menu-item } { textContent 'Open package by ID…' }
 !pkg-open-btn.setAttribute role menuitem

 ; to pkg-page-btn !document.createElement button
 ; assign $pkg-page-btn { type button } { className top-rail-menu-item } { textContent 'Packages page…' }
 !pkg-page-btn.setAttribute role menuitem

 !packages-menu.appendChild $pkg-menu-title
 !packages-menu.appendChild $pkg-menu-list
 !packages-menu.appendChild $pkg-menu-div
 !packages-menu.appendChild $pkg-create-btn
 !packages-menu.appendChild $pkg-open-btn
 !packages-menu.appendChild $pkg-page-btn

 ; to pref-menu !document.createElement div
 ; assign $pref-menu { className 'top-rail-menu top-rail-menu--preferences' } { hidden true }
 !pref-menu.setAttribute role menu
 !pref-menu.setAttribute aria-label 'Preferences menu'

 ; to pref-status-el !document.createElement div
 ; assign $pref-status-el { className top-rail-menu-status } { textContent 'No preferences lane set' }

 ; to pref-open-btn !document.createElement button
 ; assign $pref-open-btn { type button } { className 'top-rail-menu-item top-rail-menu-item--primary' } { textContent 'Open preferences lane' } { hidden true }
 !pref-open-btn.setAttribute role menuitem

 ; to pref-set-btn !document.createElement button
 ; assign $pref-set-btn { type button } { className top-rail-menu-item } { textContent 'Set preferences lane' }
 !pref-set-btn.setAttribute role menuitem

 ; to pref-create-btn !document.createElement button
 ; assign $pref-create-btn { type button } { className top-rail-menu-item } { textContent 'Create preference lane' }
 !pref-create-btn.setAttribute role menuitem

 !pref-menu.appendChild $pref-status-el
 !pref-menu.appendChild $pref-open-btn
 !pref-menu.appendChild $pref-set-btn
 !pref-menu.appendChild $pref-create-btn

 ; to chip-menu !document.createElement div
 ; assign $chip-menu { className 'top-rail-menu top-rail-menu--chip' } { hidden true }
 !chip-menu.setAttribute role dialog
 !chip-menu.setAttribute aria-label 'Chip details'

 ; to chip-menu-title-el !document.createElement div
 ; assign $chip-menu-title-el { className top-rail-chip-menu-title } { textContent '' }

 ; to chip-menu-synced-el !document.createElement div
 ; assign $chip-menu-synced-el { className top-rail-chip-menu-synced } { textContent 'Last synced: Never' }

 ; to chip-menu-actions-el !document.createElement div
 ; set top-rail-chip-menu-actions chip-menu-actions-el.className

 ; to chip-sync-btn !document.createElement button
 ; assign $chip-sync-btn { type button } { className 'top-rail-chip-menu-btn top-rail-chip-menu-btn--sync' } { textContent 'Sync now' }

 ; to chip-copy-btn !document.createElement button
 ; assign $chip-copy-btn { type button } { className 'top-rail-chip-menu-btn top-rail-chip-menu-btn--copy' } { textContent Copy }

 !chip-menu-actions-el.appendChild $chip-sync-btn
 !chip-menu-actions-el.appendChild $chip-copy-btn
 !chip-menu.appendChild $chip-menu-title-el
 !chip-menu.appendChild $chip-menu-synced-el
 !chip-menu.appendChild $chip-menu-actions-el

 ; to clock-menu !document.createElement div
 ; assign $clock-menu { className 'top-rail-menu top-rail-menu--clock' } { hidden true }
 !clock-menu.setAttribute role dialog
 !clock-menu.setAttribute aria-label 'Clock and timezone preferences'

 ; to clock-header-el !document.createElement div
 ; set top-rail-clock-header clock-header-el.className

 ; to clock-full-time-el !document.createElement div
 ; assign $clock-full-time-el { className top-rail-clock-full-time } { textContent '' }

 ; to clock-active-tz-el !document.createElement div
 ; assign $clock-active-tz-el { className top-rail-clock-active-tz } { textContent '' }

 !clock-header-el.appendChild $clock-full-time-el
 !clock-header-el.appendChild $clock-active-tz-el

 ; to clock-prefs-el !document.createElement div
 ; set top-rail-clock-prefs clock-prefs-el.className

 ; to clock-hour-group !document.createElement div
 ; set top-rail-clock-hour-group clock-hour-group.className
 !clock-hour-group.setAttribute role group
 !clock-hour-group.setAttribute aria-label 'Hour format'

 ; to clock-12h-btn !document.createElement button
 ; assign $clock-12h-btn { type button } { className 'top-rail-clock-hour-btn top-rail-clock-hour-btn--active' } { textContent '12h' } { title '12-hour clock' }
 !clock-12h-btn.setAttribute aria-pressed 'true'

 ; to clock-24h-btn !document.createElement button
 ; assign $clock-24h-btn { type button } { className top-rail-clock-hour-btn } { textContent '24h' } { title '24-hour clock' }
 !clock-24h-btn.setAttribute aria-pressed 'false'

 !clock-hour-group.appendChild $clock-12h-btn
 !clock-hour-group.appendChild $clock-24h-btn

 ; to clock-seconds-label !document.createElement label
 ; set top-rail-clock-seconds-toggle clock-seconds-label.className

 ; to clock-seconds-check !document.createElement input
 ; assign $clock-seconds-check { type checkbox } { className top-rail-clock-seconds-check } { checked true }
 !clock-seconds-check.setAttribute aria-label 'Show seconds'

 ; to clock-seconds-text !document.createElement span
 ; assign $clock-seconds-text { className top-rail-clock-seconds-text } { textContent 'Show seconds' }

 !clock-seconds-label.appendChild $clock-seconds-check
 !clock-seconds-label.appendChild $clock-seconds-text

 !clock-prefs-el.appendChild $clock-hour-group
 !clock-prefs-el.appendChild $clock-seconds-label

 ; to clock-search-wrap !document.createElement div
 ; set top-rail-clock-search-wrap clock-search-wrap.className

 ; to clock-search-input !document.createElement input
 ; assign $clock-search-input { type search } { className top-rail-clock-search } { placeholder 'Filter timezones…' } { value '' }
 !clock-search-input.setAttribute aria-label 'Filter timezones'
 !clock-search-wrap.appendChild $clock-search-input

 ; to clock-hint-el !document.createElement div
 ; assign $clock-hint-el { className top-rail-clock-hint } { textContent '' }

 ; to clock-list-el !document.createElement div
 ; set top-rail-clock-list clock-list-el.className
 !clock-list-el.setAttribute role listbox
 !clock-list-el.setAttribute aria-label 'Available timezones'

 ; to clock-empty-el !document.createElement div
 ; assign $clock-empty-el { className top-rail-clock-empty } { textContent 'No matching timezones' } { hidden true }

 ; to clock-footer-el !document.createElement div
 ; assign $clock-footer-el { className top-rail-clock-footer } { hidden true }

 ; to clock-manage-btn !document.createElement button
 ; assign $clock-manage-btn { type button } { className 'top-rail-menu-item top-rail-menu-item--primary top-rail-clock-manage-btn' } { textContent 'Manage timezones in Preferences ↗' }
 !clock-footer-el.appendChild $clock-manage-btn

 !clock-menu.appendChild $clock-header-el
 !clock-menu.appendChild $clock-prefs-el
 !clock-menu.appendChild $clock-search-wrap
 !clock-menu.appendChild $clock-hint-el
 !clock-menu.appendChild $clock-list-el
 !clock-menu.appendChild $clock-empty-el
 !clock-menu.appendChild $clock-footer-el

 ; to left-rail !document.createElement aside
 ; set 'side-rail side-rail--left' left-rail.className
 !left-rail.setAttribute role region
 !left-rail.setAttribute aria-label 'Left minimized lanes rail'

 ; to prev-nav !document.createElement div
 ; assign $prev-nav { className 'side-rail-nav side-rail-nav--left' } { hidden true }
 ; to prev-nav-tab !document.createElement button
 ; assign $prev-nav-tab { type button } { className side-rail-nav-tab } { title 'Previous sessions' }
 !prev-nav-tab.setAttribute aria-label 'Previous sessions'
 !prev-nav-tab.setAttribute aria-haspopup menu
 !prev-nav-tab.setAttribute aria-expanded 'false'
 ; to prev-nav-icon !document.createElement span
 ; assign $prev-nav-icon { innerHTML $prev-arrow-svg }
 ; to prev-nav-count !document.createElement span
 ; assign $prev-nav-count { className side-rail-nav-count } { textContent '' } { hidden true }
 !prev-nav-tab.appendChild $prev-nav-icon
 !prev-nav-tab.appendChild $prev-nav-count
 ; to prev-nav-menu !document.createElement div
 ; assign $prev-nav-menu { className 'side-rail-nav-menu side-rail-nav-menu--left' } { hidden true }
 !prev-nav-menu.setAttribute role menu
 !prev-nav-menu.setAttribute aria-label 'Previous sessions'
 ; to prev-nav-title !document.createElement div
 ; assign $prev-nav-title { className side-rail-nav-title } { textContent Previous }
 ; to prev-nav-draft !document.createElement div
 ; assign $prev-nav-draft { className workspace-session-draft } { hidden true }
 ; to prev-nav-draft-label !document.createElement div
 ; assign $prev-nav-draft-label { className workspace-session-draft-label } { textContent 'Unsaved version' }
 ; to prev-nav-draft-actions !document.createElement div
 ; set workspace-session-draft-actions prev-nav-draft-actions.className
 ; to prev-nav-save-btn !document.createElement button
 ; assign $prev-nav-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
 ; to prev-nav-fork-btn !document.createElement button
 ; assign $prev-nav-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
 ; to prev-nav-abandon-btn !document.createElement button
 ; assign $prev-nav-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent Abandon }
 !prev-nav-draft-actions.appendChild $prev-nav-save-btn
 !prev-nav-draft-actions.appendChild $prev-nav-fork-btn
 !prev-nav-draft-actions.appendChild $prev-nav-abandon-btn
 !prev-nav-draft.appendChild $prev-nav-draft-label
 !prev-nav-draft.appendChild $prev-nav-draft-actions
 ; to prev-nav-list !document.createElement div
 ; set side-rail-nav-list prev-nav-list.className
 !prev-nav-menu.appendChild $prev-nav-title
 !prev-nav-menu.appendChild $prev-nav-draft
 !prev-nav-menu.appendChild $prev-nav-list
 !prev-nav.appendChild $prev-nav-tab
 !prev-nav.appendChild $prev-nav-menu
 !left-rail.appendChild $prev-nav

 ; to right-rail !document.createElement aside
 ; set 'side-rail side-rail--right' right-rail.className
 !right-rail.setAttribute role region
 !right-rail.setAttribute aria-label 'Right minimized lanes rail'

 ; to next-nav !document.createElement div
 ; assign $next-nav { className 'side-rail-nav side-rail-nav--right' } { hidden true }
 ; to next-nav-tab !document.createElement button
 ; assign $next-nav-tab { type button } { className side-rail-nav-tab } { title 'Next sessions' }
 !next-nav-tab.setAttribute aria-label 'Next sessions'
 !next-nav-tab.setAttribute aria-haspopup menu
 !next-nav-tab.setAttribute aria-expanded 'false'
 ; to next-nav-icon !document.createElement span
 ; assign $next-nav-icon { innerHTML $next-arrow-svg }
 ; to next-nav-count !document.createElement span
 ; assign $next-nav-count { className side-rail-nav-count } { textContent '' } { hidden true }
 !next-nav-tab.appendChild $next-nav-icon
 !next-nav-tab.appendChild $next-nav-count
 ; to next-nav-menu !document.createElement div
 ; assign $next-nav-menu { className 'side-rail-nav-menu side-rail-nav-menu--right' } { hidden true }
 !next-nav-menu.setAttribute role menu
 !next-nav-menu.setAttribute aria-label 'Next sessions'
 ; to next-nav-title !document.createElement div
 ; assign $next-nav-title { className side-rail-nav-title } { textContent Next }
 ; to next-nav-draft !document.createElement div
 ; assign $next-nav-draft { className workspace-session-draft } { hidden true }
 ; to next-nav-draft-label !document.createElement div
 ; assign $next-nav-draft-label { className workspace-session-draft-label } { textContent 'Unsaved version' }
 ; to next-nav-draft-actions !document.createElement div
 ; set workspace-session-draft-actions next-nav-draft-actions.className
 ; to next-nav-save-btn !document.createElement button
 ; assign $next-nav-save-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--save' } { textContent Save }
 ; to next-nav-fork-btn !document.createElement button
 ; assign $next-nav-fork-btn { type button } { className workspace-mini-btn } { textContent Fork }
 ; to next-nav-abandon-btn !document.createElement button
 ; assign $next-nav-abandon-btn { type button } { className 'workspace-mini-btn workspace-mini-btn--danger' } { textContent Abandon }
 !next-nav-draft-actions.appendChild $next-nav-save-btn
 !next-nav-draft-actions.appendChild $next-nav-fork-btn
 !next-nav-draft-actions.appendChild $next-nav-abandon-btn
 !next-nav-draft.appendChild $next-nav-draft-label
 !next-nav-draft.appendChild $next-nav-draft-actions
 ; to next-nav-list !document.createElement div
 ; set side-rail-nav-list next-nav-list.className
 !next-nav-menu.appendChild $next-nav-title
 !next-nav-menu.appendChild $next-nav-draft
 !next-nav-menu.appendChild $next-nav-list
 !next-nav.appendChild $next-nav-tab
 !next-nav.appendChild $next-nav-menu
 !right-rail.appendChild $next-nav

 ; to preview-el !document.createElement div
 ; set side-rail-preview preview-el.className
 !preview-el.setAttribute aria-hidden 'true'
 ; set true preview-el.hidden

 ; to preview-frame !document.createElement div
 ; set side-rail-preview-frame preview-frame.className
 ; to preview-header !document.createElement div
 ; set 'side-rail-preview-header lane-header' preview-header.className
 ; to preview-body !document.createElement div
 ; set 'side-rail-preview-body lane-body' preview-body.className
 !preview-frame.appendChild $preview-header
 !preview-frame.appendChild $preview-body
 !preview-el.appendChild $preview-frame

 ; to preview-resizer !document.createElement div
 ; assign $preview-resizer { className side-rail-preview-resizer } { hidden true } { title 'Drag to resize floating panel (double-click to reset)' }
 !preview-resizer.setAttribute role separator
 !preview-resizer.setAttribute aria-orientation vertical
 !preview-resizer.setAttribute aria-label 'Resize floating panel'

 ; to restore-btn !document.createElement button
 ; assign $restore-btn { type button } { className side-rail-restore } { hidden true } { title 'Restore lane' } { innerHTML $restore-right-svg }
 !restore-btn.setAttribute aria-label 'Restore lane'

 [ match
  { $document.body (
   !document.body.appendChild $top-rail
   !document.body.appendChild $session-menu
   !document.body.appendChild $packages-menu
   !document.body.appendChild $pref-menu
   !document.body.appendChild $chip-menu
   !document.body.appendChild $clock-menu
   !document.body.appendChild $left-rail
   !document.body.appendChild $right-rail
   !document.body.appendChild $preview-el
   !document.body.appendChild $preview-resizer
   !document.body.appendChild $restore-btn
  ) }
 ]

 ; to rails [ object
  { top-rail $top-rail }
  { fullscreen-btn $fullscreen-btn }
  { search-btn $search-btn }
  { session-btn $session-btn }
  { session-menu $session-menu }
  { session-status-el $session-status-el }
  { session-dir-el $session-dir-el }
  { session-draft-row $session-draft-row }
  { session-draft-label $session-draft-label }
  { session-draft-actions $session-draft-actions }
  { session-save-btn $session-save-btn }
  { session-draft-fork-btn $session-draft-fork-btn }
  { session-abandon-btn $session-abandon-btn }
  { session-new-btn $session-new-btn }
  { session-fork-btn $session-fork-btn }
  { session-manage-btn $session-manage-btn }
  { session-history-btn $session-history-btn }
  { session-copy-btn $session-copy-btn }
  { session-recent-el $session-recent-el }
  { session-recent-els {} }
  { session-recent-items {} }
  { is-session-open false }
  { packages-btn $packages-btn }
  { packages-menu $packages-menu }
  { pkg-menu-list $pkg-menu-list }
  { pkg-create-btn $pkg-create-btn }
  { pkg-open-btn $pkg-open-btn }
  { pkg-page-btn $pkg-page-btn }
  { pkg-els {} }
  { pkg-items {} }
  { is-packages-open false }
  { servers-btn $servers-btn }
  { preferences-btn $preferences-btn }
  { preferences-menu $pref-menu }
  { preferences-status-el $pref-status-el }
  { preferences-open-btn $pref-open-btn }
  { preferences-set-btn $pref-set-btn }
  { preferences-create-btn $pref-create-btn }
  { is-fullscreen false }
  { is-preferences-open false }
  { left-rail $left-rail }
  { right-rail $right-rail }
  { prev-nav $prev-nav }
  { prev-nav-tab $prev-nav-tab }
  { prev-nav-count $prev-nav-count }
  { prev-nav-menu $prev-nav-menu }
  { prev-nav-draft $prev-nav-draft }
  { prev-nav-draft-label $prev-nav-draft-label }
  { prev-nav-draft-actions $prev-nav-draft-actions }
  { prev-nav-save-btn $prev-nav-save-btn }
  { prev-nav-fork-btn $prev-nav-fork-btn }
  { prev-nav-abandon-btn $prev-nav-abandon-btn }
  { prev-nav-list $prev-nav-list }
  { prev-nav-els {} }
  { prev-nav-items {} }
  { is-prev-nav-open false }
  { prev-nav-hover false }
  { next-nav $next-nav }
  { next-nav-tab $next-nav-tab }
  { next-nav-count $next-nav-count }
  { next-nav-menu $next-nav-menu }
  { next-nav-draft $next-nav-draft }
  { next-nav-draft-label $next-nav-draft-label }
  { next-nav-draft-actions $next-nav-draft-actions }
  { next-nav-save-btn $next-nav-save-btn }
  { next-nav-fork-btn $next-nav-fork-btn }
  { next-nav-abandon-btn $next-nav-abandon-btn }
  { next-nav-list $next-nav-list }
  { next-nav-els {} }
  { next-nav-items {} }
  { is-next-nav-open false }
  { next-nav-hover false }
  { preview-el $preview-el }
  { preview-frame $preview-frame }
  { preview-header $preview-header }
  { preview-body $preview-body }
  { preview-resizer $preview-resizer }
  { restore-btn $restore-btn }
  { left-items {} }
  { right-items {} }
  { by-id ; object }
  { preview-lane null }
  { pinned-lane null }
  { preview-side null }
  { is-preview-pinned false }
  { is-preview-resizing false }
  { is-resizer-hover false }
  { active-resize-cleanup null }
  { restore-fade-delay 25000 }
  { restore-hide-delay 30000 }
  { restore-fade-timer null }
  { restore-hide-timer null }
  { is-restore-fading false }
  { is-restore-expired false }
  { top-elements {} }
  { top-element-nodes {} }
  { top-order {} }
  { top-hidden {} }
  { top-chip-items {} }
  { chip-menu $chip-menu }
  { chip-menu-title-el $chip-menu-title-el }
  { chip-menu-synced-el $chip-menu-synced-el }
  { chip-menu-actions-el $chip-menu-actions-el }
  { chip-sync-btn $chip-sync-btn }
  { chip-copy-btn $chip-copy-btn }
  { is-chip-menu-open false }
  { active-chip-el null }
  { active-chip-item null }
  { active-chip-index -1 }
  { clock-btn $clock-btn }
  { clock-menu $clock-menu }
  { clock-full-time-el $clock-full-time-el }
  { clock-active-tz-el $clock-active-tz-el }
  { clock-prefs-el $clock-prefs-el }
  { clock-hour-group $clock-hour-group }
  { clock-12h-btn $clock-12h-btn }
  { clock-24h-btn $clock-24h-btn }
  { clock-seconds-label $clock-seconds-label }
  { clock-seconds-check $clock-seconds-check }
  { clock-search-input $clock-search-input }
  { clock-hint-el $clock-hint-el }
  { clock-list-el $clock-list-el }
  { clock-empty-el $clock-empty-el }
  { clock-footer-el $clock-footer-el }
  { clock-manage-btn $clock-manage-btn }
  { clock-option-els {} }
  { clock-options {} }
  { clock-filtered-options {} }
  { clock-timezones {} }
  { clock-active-option null }
  { clock-search-query '' }
  { is-clock-open false }
  { clock-timer null }
 ]

 ; to min-lane-modal-width [ match
  { [ propertyIsGreaterThan 0 minLaneModalWidth ] : $minLaneModalWidth }
  { true : 480 }
 ]
 ; to min-lane-modal-height [ match
  { [ propertyIsGreaterThan 0 minLaneModalHeight ] : $minLaneModalHeight }
  { true : 420 }
 ]
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
 ; to sync-preview-width (
  -- Applies or clears lane width, modal minimum dimensions, classes, and custom properties on the floating preview containers
  ; to { rendered lane } $argv
  ; to has-modal [ match
   { [ propertyIs true lane.has-open-modal ] : true }
   { true : false }
  ]
  ; to modal-min-w [ match
   { [ and { $has-modal } { [ propertyIsGreaterThan 0 lane.modal-min-width ] } ] : $lane.modal-min-width }
   { $has-modal : $min-lane-modal-width }
   { true : null }
  ]
  ; to has-width [ match
   { [ propertyIs null rendered ] : false }
   { [ propertyIs undefined rendered ] : false }
   { true : true }
  ]
  ; to effective [ match
   { $has-width (
    [ match
     { $modal-min-w : !window.Math.max $rendered $modal-min-w }
     { true : $rendered }
    ]
   ) }
   { true : null }
  ]
  ; to px-str [ match
   { $has-width : ; add $effective px }
   { true : '' }
  ]
  ; to min-px-str [ match
   { $modal-min-w : ; add $modal-min-w px }
   { $has-width : 100px }
   { true : '' }
  ]
  ; to modal-min-w-str [ match
   { $modal-min-w : ; add $modal-min-w px }
   { true : '' }
  ]
  ; to modal-min-h-str [ match
   { $has-modal : ; add $min-lane-modal-height px }
   { true : '' }
  ]
  ; each { $preview-el $preview-frame $preview-header $preview-body } (
   ; to { el } $argv
   [ match
    { $has-modal : !el.setAttribute data-modal-open 'true' }
    { true : !remove-elem-attr $el data-modal-open }
   ]
  )
  [ match
   { $preview-el.style (
    ; set $modal-min-w-str preview-el.style.minWidth
    ; set $modal-min-h-str preview-el.style.minHeight
   ) }
  ]
  [ match
   { $preview-frame.style (
    ; set $modal-min-w-str preview-frame.style.minWidth
    ; set $modal-min-h-str preview-frame.style.minHeight
   ) }
  ]
  ; set [ ternary $has-width 'side-rail-preview-header lane-header lane-header--sized' 'side-rail-preview-header lane-header' ] preview-header.className
  ; set [ ternary $has-width 'side-rail-preview-body lane-body lane-body--sized' 'side-rail-preview-body lane-body' ] preview-body.className
  ; each { $preview-header $preview-body } (
   ; to { box } $argv
   [ match
    { $box.style (
     ; set $px-str box.style.width
     ; set $px-str box.style.maxWidth
     ; set $min-px-str box.style.minWidth
     [ match
      { $box.style.setProperty (
       [ match
        { $has-width : !box.style.setProperty '--lane-width' $px-str }
        { true (
         [ match
          { $box.style.removeProperty : !box.style.removeProperty '--lane-width' }
         ]
        ) }
       ]
      ) }
      { true : ; set $px-str box.style.--lane-width }
     ]
    ) }
   ]
  )
  [ match
   { $preview-body.style : ; set $modal-min-h-str preview-body.style.minHeight }
  ]
  [ match
   { $rails.sync-preview-resizer : !rails.sync-preview-resizer }
  ]
 )

 ; to resolve-num (
  -- Returns a finite numeric value unchanged or null for non-numeric inputs
  ; to { v } $argv
  [ match
   { [ propertyIs null v ] : null }
   { [ propertyIs undefined v ] : null }
   { [ propertyIs '' v ] : null }
   { [ propertyIs true v ] : null }
   { [ propertyIs false v ] : null }
   { [ propertyIsGreaterThanOrEqual 0 v ] : $v }
   { [ propertyIsLessThan 0 v ] : $v }
   { true : null }
  ]
 )

 ; to resolve-active-preview-side (
  -- Resolves left or right rail side for the active floating preview lane
  ; to { lane } $argv
  ; to item [ match
   { $lane : [ get rails.by-id $lane.id ] }
   { true : null }
  ]
  [ match
   { $item.side : $item.side }
   { $rails.preview-side : $rails.preview-side }
   { $lane.minimized-side : $lane.minimized-side }
   { true : left }
  ]
 )

 ; to sync-preview-classes (
  -- Syncs side, pinned, and resizing classes on preview-el
  ; to { side is-pinned } $argv
  ; to base-side-cls ; add 'side-rail-preview side-rail-preview--' $side
  ; to pin-cls [ ternary $is-pinned [ ; add $base-side-cls ' side-rail-preview--pinned' ] $base-side-cls ]
  ; to full-cls [ ternary $rails.is-preview-resizing [ ; add $pin-cls ' side-rail-preview--resizing' ] $pin-cls ]
  ; set $full-cls preview-el.className
 )

 ; to sync-resizer-class (
  -- Syncs side, hover, and active classes on preview-resizer
  ; to { side } $argv
  ; to active-side [ match
   { $side : $side }
   { $rails.preview-lane : !resolve-active-preview-side $rails.preview-lane }
   { true : '' }
  ]
  ; to base-cls [ match
   { $active-side : ; add 'side-rail-preview-resizer side-rail-preview-resizer--' $active-side }
   { true : side-rail-preview-resizer }
  ]
  ; to next-cls [ match
   { [ propertyIs true rails.is-preview-resizing ] : ; add $base-cls ' side-rail-preview-resizer--active' }
   { [ propertyIs true rails.is-resizer-hover ] : ; add $base-cls ' side-rail-preview-resizer--hover' }
   { true : $base-cls }
  ]
  ; set $next-cls preview-resizer.className
 )

 ; to finish-preview-resize (
  -- Ends any active floating panel drag resize session and restores listeners and cursor
  ; to { should-save } $argv
  ; to cleanup $rails.active-resize-cleanup
  [ match
   { $cleanup (
    ; set null rails.active-resize-cleanup
    !cleanup $should-save
   ) }
  ]
 )

 ; to rails.sync-preview-resizer (
  -- Positions and shows preview-resizer along the floating panel edge furthest from the rail it resides on
  ; to active-lane $rails.preview-lane
  ; to is-visible [ match
   { [ and { $active-lane } { propertyIs true rails.is-preview-pinned } { propertyIs false preview-el.hidden } ] : true }
   { true : false }
  ]
  [ match
   { [ propertyIs false is-visible ] (
    ; set true preview-resizer.hidden
    ; set side-rail-preview-resizer preview-resizer.className
    !remove-elem-attr $preview-resizer data-lane-id
    !remove-elem-attr $preview-resizer data-rail-side
    !remove-elem-attr $preview-resizer data-resize-edge
    !preview-resizer.setAttribute aria-label 'Resize floating panel'
   ) }
   { true (
    ; to side !resolve-active-preview-side $active-lane
    ; to resize-edge [ ternary [ propertyIs left side ] right left ]
    ; set false preview-resizer.hidden
    !sync-resizer-class $side
    !preview-resizer.setAttribute data-lane-id $active-lane.id
    !preview-resizer.setAttribute data-rail-side $side
    !preview-resizer.setAttribute data-resize-edge $resize-edge
    ; to lane-lbl [ match { $active-lane.title : $active-lane.title } { true : 'floating panel' } ]
    !preview-resizer.setAttribute aria-label [ ; add 'Resize ' $lane-lbl ]
    ; to prect [ match
     { $preview-el.getBoundingClientRect : !preview-el.getBoundingClientRect }
     { true : null }
    ]
    ; to raw-top !resolve-num $prect.top
    ; to top-val [ match
     { [ propertyIs null raw-top ] : 24 }
     { [ propertyIsGreaterThanOrEqual 0 raw-top ] : $raw-top }
     { true : 24 }
    ]
    ; to rect-h !resolve-num $prect.height
    ; to h-str [ match
     { [ propertyIs null rect-h ] : '' }
     { [ propertyIsGreaterThan 0 rect-h ] : ; add [ !window.Math.round $rect-h ] px }
     { true : '' }
    ]
    ; to rect-left !resolve-num $prect.left
    ; to rect-right !resolve-num $prect.right
    ; to rect-w !resolve-num $prect.width
    ; to has-left [ match { [ propertyIs null rect-left ] : false } { true : true } ]
    ; to has-right [ match { [ propertyIs null rect-right ] : false } { true : true } ]
    ; to has-rect-w [ match
     { [ propertyIs null rect-w ] : false }
     { [ propertyIsGreaterThan 0 rect-w ] : true }
     { true : false }
    ]
    ; to fallback-w [ match
     { $has-rect-w : $rect-w }
     { [ propertyIsGreaterThan 0 active-lane.effective-width ] : $active-lane.effective-width }
     { [ propertyIsGreaterThan 0 active-lane.rendered-width ] : $active-lane.rendered-width }
     { true : 320 }
    ]
    ; to vw [ match
     { [ propertyIsGreaterThan 0 window.innerWidth ] : $window.innerWidth }
     { true : null }
    ]
    [ match
     { $preview-resizer.style (
      ; set [ ; add [ !window.Math.round $top-val ] px ] preview-resizer.style.top
      ; set $h-str preview-resizer.style.height
      [ match
       { [ propertyIs right side ] (
        ; to has-real-rect [ match
         { [ and { $has-left } { $has-right } { propertyIsGreaterThan $rect-left rect-right } ] : true }
         { true : false }
        ]
        [ match
         { $has-real-rect (
          ; to edge-x ; subtract $rect-left 4
          ; set [ ; add [ !window.Math.round $edge-x ] px ] preview-resizer.style.left
          ; set auto preview-resizer.style.right
         ) }
         { $vw (
          ; to edge-x ; subtract [ ; subtract [ ; subtract $vw 38 ] $fallback-w ] 4
          ; set [ ; add [ !window.Math.round $edge-x ] px ] preview-resizer.style.left
          ; set auto preview-resizer.style.right
         ) }
         { true (
          ; to edge-r ; subtract [ ; add 38 $fallback-w ] 4
          ; set auto preview-resizer.style.left
          ; set [ ; add [ !window.Math.round $edge-r ] px ] preview-resizer.style.right
         ) }
        ]
       ) }
       { true (
        ; to edge-x [ match
         { [ and { $has-right } { propertyIsGreaterThan 0 rect-right } ] : $rect-right }
         { [ and { $has-left } { propertyIsGreaterThan 0 rect-left } ] : ; add $rect-left $fallback-w }
         { true : ; add 38 $fallback-w }
        ]
        ; to left-pos ; subtract $edge-x 4
        ; set [ ; add [ !window.Math.round $left-pos ] px ] preview-resizer.style.left
        ; set auto preview-resizer.style.right
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to restore-node (
  -- Re-inserts a previewed child node back into its owning container before an optional reference node
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

 ; to is-node-inside (
  -- Returns true when target equals root or is contained inside root
  ; to { root target } $argv
  [ match
   { [ propertyIs $root target ] : true }
   { $root.contains : !root.contains $target }
   { true : false }
  ]
 )

 ; to reset-rail-item-pin (
  -- Resets pin state, class, and ARIA attributes on a rail item
  ; to { item } $argv
  [ match
   { $item (
    ; set false item.pinned
    ; set side-rail-icon item.icon-el.className
    !item.icon-el.setAttribute aria-pressed 'false'
    !item.icon-el.setAttribute aria-expanded 'false'
    !item.icon-el.setAttribute aria-label [ ; add 'Pin ' $item.lane.title ]
   ) }
  ]
 )

 ; to clear-restore-timers (
  -- Cancels any scheduled 25s fade-start and 30s hide timers for the floating restore arrow button
  [ match
   { $rails.restore-fade-timer (
    [ match
     { $window.clearTimeout : !window.clearTimeout $rails.restore-fade-timer }
    ]
    ; set null rails.restore-fade-timer
   ) }
  ]
  [ match
   { $rails.restore-hide-timer (
    [ match
     { $window.clearTimeout : !window.clearTimeout $rails.restore-hide-timer }
    ]
    ; set null rails.restore-hide-timer
   ) }
  ]
 )

 ; to sync-restore-btn-class (
  -- Syncs the floating restore button class list from active rail side, pin state, and 25s-30s fade state
  ; to active-lane $rails.preview-lane
  [ match
   { $active-lane (
    ; to active-item [ get rails.by-id $active-lane.id ]
    ; to side [ match
     { $active-item.side : $active-item.side }
     { $restore-btn.getAttribute : !restore-btn.getAttribute data-rail-side }
     { true : left }
    ]
    ; to base-cls ; add 'side-rail-restore side-rail-restore--' $side
    ; to pin-cls [ ternary $rails.is-preview-pinned [ ; add $base-cls ' side-rail-restore--pinned' ] $base-cls ]
    ; to full-cls [ ternary $rails.is-restore-fading [ ; add $pin-cls ' side-rail-restore--fading' ] $pin-cls ]
    ; set $full-cls restore-btn.className
   ) }
   { true : ; set side-rail-restore restore-btn.className }
  ]
 )

 ; to rails.activate-restore-btn (
  -- Instantly enables the floating restore arrow button next to the rail icon and starts its 25s fade / 30s hide lifecycle
  ; to { icon-el } $argv
  !clear-restore-timers
  ; to active-lane $rails.preview-lane
  [ match
   { $active-lane (
    ; set false rails.is-restore-fading
    ; set false rails.is-restore-expired
    ; set false restore-btn.hidden
    !sync-restore-btn-class
    [ match
     { $icon-el (
      ; to desired-top [ match
       { $icon-el.getBoundingClientRect (
        ; to rect !icon-el.getBoundingClientRect
        [ match
         { [ propertyIsGreaterThanOrEqual 0 rect.top ] : $rect.top }
         { true : 24 }
        ]
       ) }
       { true : 24 }
      ]
      [ match
       { $restore-btn.style : ; set [ ; add [ !window.Math.round $desired-top ] px ] restore-btn.style.top }
      ]
     ) }
    ]
    [ match
     { $window.setTimeout (
      ; to fade-t !window.setTimeout (
       ; set null rails.restore-fade-timer
       [ match
        { $rails.preview-lane (
         ; set true rails.is-restore-fading
         !sync-restore-btn-class
        ) }
       ]
      ) $rails.restore-fade-delay
      ; set $fade-t rails.restore-fade-timer
      ; to hide-t !window.setTimeout (
       ; set null rails.restore-hide-timer
       [ match
        { $rails.preview-lane (
         ; set false rails.is-restore-fading
         ; set true rails.is-restore-expired
         ; set true restore-btn.hidden
         !sync-restore-btn-class
        ) }
       ]
      ) $rails.restore-hide-delay
      ; set $hide-t rails.restore-hide-timer
     ) }
    ]
   ) }
  ]
 )

 ; to rails.hide-preview (
  -- Hides the floating hover/pinned preview and restore arrow button and returns live lane DOM nodes to their owning lane cells
  !clear-restore-timers
  !finish-preview-resize false
  ; to pinned $rails.pinned-lane
  ; to lane $rails.preview-lane
  ; set null rails.pinned-lane
  ; set null rails.preview-side
  ; set false rails.is-preview-pinned
  ; set false rails.is-preview-resizing
  ; set false rails.is-resizer-hover
  ; set false rails.is-restore-fading
  ; set false rails.is-restore-expired
  [ match
   { $pinned (
    ; to pinned-item [ get rails.by-id $pinned.id ]
    !reset-rail-item-pin $pinned-item
   ) }
  ]
  ; set side-rail-restore restore-btn.className
  ; set true restore-btn.hidden
  ; set 'Restore lane' restore-btn.title
  !restore-btn.setAttribute aria-label 'Restore lane'
  !restore-btn.setAttribute data-lane-id ''
  !restore-btn.setAttribute data-rail-side ''
  [ match
   { $lane (
    ; set null rails.preview-lane
    ; to active-item [ get rails.by-id $lane.id ]
    !reset-rail-item-pin $active-item
    !restore-node $lane.element $lane.header-top $lane.header-resizer
    [ match
     { $lane.body (
      ; to body-ref [ match
       { $lane.body-resizer : $lane.body-resizer }
       { $lane.minimized-placeholder : $lane.minimized-placeholder }
       { true : null }
      ]
      [ match
       { $lane.notebook.element : !restore-node $lane.body $lane.notebook.element $body-ref }
      ]
      [ match
       { $lane.notebook.output-view.element : !restore-node $lane.body $lane.notebook.output-view.element $body-ref }
      ]
      [ match
       { $lane.open-modals (
        ; each $lane.open-modals (
         ; to { open-m } $argv
         [ match
          { $open-m.backdrop : !restore-node $lane.body $open-m.backdrop $body-ref }
         ]
        )
       ) }
      ]
     ) }
    ]
    !sync-preview-width null null
    ; set side-rail-preview preview-el.className
    ; set true preview-el.hidden
    !preview-el.setAttribute aria-hidden 'true'
   ) }
  ]
  !rails.sync-preview-resizer
 )

 ; to apply-pin-state (
  -- Updates pinned state and classes on the active preview, floating restore button, and rail item without remounting DOM nodes
  ; to { item is-pinned } $argv
  ; to lane $item.lane
  ; to side $item.side
  ; set [ ternary $is-pinned $lane null ] rails.pinned-lane
  ; set $side rails.preview-side
  ; set $is-pinned rails.is-preview-pinned
  ; set $is-pinned item.pinned
  ; set [ ternary $is-pinned 'side-rail-icon side-rail-icon--pinned' side-rail-icon ] item.icon-el.className
  !item.icon-el.setAttribute aria-pressed [ ternary $is-pinned 'true' 'false' ]
  !item.icon-el.setAttribute aria-expanded 'true'
  !item.icon-el.setAttribute aria-label [ ; add [ ternary $is-pinned 'Unpin ' 'Pin ' ] $lane.title ]
  !sync-preview-classes $side $is-pinned
  !preview-el.setAttribute aria-hidden [ ternary $is-pinned 'false' 'true' ]
  !sync-restore-btn-class
  !rails.sync-preview-resizer
 )

 ; to rails.show-preview (
  -- Shows a floating preview of a minimized lane anchored next to its rail icon (interactive when pinned) plus its floating restore arrow button
  ; to { lane icon-el side pinned } $argv
  ; to is-pinned [ propertyIs true pinned ]
  ; to has-lane-fs [ match
   { $lane-control.fullscreen-lane : true }
   { true : false }
  ]
  [ match
   { $lane (
    ; condition { and { propertyIs true lane.is-minimized } { propertyIs false has-lane-fs } } (
     !rails.hide-preview
     ; set $lane rails.preview-lane
     ; set $side rails.preview-side
     !sync-preview-width $lane.rendered-width $lane
     [ match
      { $lane.header-top : !preview-header.appendChild $lane.header-top }
     ]
     [ match
      { $lane.notebook.element : !preview-body.appendChild $lane.notebook.element }
     ]
     [ match
      { $lane.notebook.output-view.element : !preview-body.appendChild $lane.notebook.output-view.element }
     ]
     [ match
      { $lane.open-modals (
       ; each $lane.open-modals (
        ; to { open-m } $argv
        [ match
         { $open-m.backdrop : !preview-body.appendChild $open-m.backdrop }
        ]
       )
      ) }
     ]
     ; to restore-lbl ; add 'Restore ' $lane.title
     ; to restore-svg [ ternary [ propertyIs left side ] $restore-right-svg $restore-left-svg ]
     ; assign $restore-btn { title $restore-lbl } { innerHTML $restore-svg }
     !restore-btn.setAttribute aria-label $restore-lbl
     !restore-btn.setAttribute data-lane-id $lane.id
     !restore-btn.setAttribute data-rail-side $side
     ; to item [ get rails.by-id $lane.id ]
     [ match
      { $item : !apply-pin-state $item $is-pinned }
      { true (
       ; set [ ternary $is-pinned $lane null ] rails.pinned-lane
       ; set $side rails.preview-side
       ; set $is-pinned rails.is-preview-pinned
       !sync-preview-classes $side $is-pinned
       !preview-el.setAttribute aria-hidden [ ternary $is-pinned 'false' 'true' ]
      ) }
     ]
     ; set false preview-el.hidden
     [ match
      { $lane.notebook.auto-size-rows : !lane.notebook.auto-size-rows }
     ]
     ; to desired-top [ match
      { $icon-el.getBoundingClientRect (
       ; to rect !icon-el.getBoundingClientRect
       [ match
        { [ propertyIsGreaterThanOrEqual 0 rect.top ] : $rect.top }
        { true : 24 }
       ]
      ) }
      { true : 24 }
     ]
     ; to clamped-top [ match
      { $preview-el.getBoundingClientRect (
       [ match
        { [ propertyIsGreaterThan 0 window.innerHeight ] (
         ; to prect !preview-el.getBoundingClientRect
         ; to ph [ match
          { [ propertyIsGreaterThan 0 prect.height ] : $prect.height }
          { true : 0 }
         ]
         ; to raw-max ; subtract [ ; subtract $window.innerHeight $ph ] 8
         ; to max-top !window.Math.max 24 $raw-max
         !window.Math.max 24 [ !window.Math.min $desired-top $max-top ]
        ) }
        { true : !window.Math.max 24 $desired-top }
       ]
      ) }
      { true : !window.Math.max 24 $desired-top }
     ]
     [ match
      { $preview-el.style : ; set [ ; add [ !window.Math.round $clamped-top ] px ] preview-el.style.top }
     ]
     !rails.activate-restore-btn $icon-el
     !rails.sync-preview-resizer
    )
   ) }
  ]
 )

 ; to rails.pin (
  -- Pins a minimized lane's popover open for interaction and displays its floating restore arrow button
  ; to { id } $argv
  ; to item [ get rails.by-id $id ]
  [ match
   { $item (
    [ match
     { [ propertyIs $item.lane rails.preview-lane ] (
      !apply-pin-state $item true
      !rails.activate-restore-btn $item.icon-el
     ) }
     { true : !rails.show-preview $item.lane $item.icon-el $item.side true }
    ]
    $item
   ) }
  ]
 )

 ; to rails.unpin (
  -- Unpins and closes any currently pinned minimized lane popover
  !rails.hide-preview
 )

 ; to rails.toggle-pin (
  -- Toggles a minimized lane's popover between pinned open and closed
  ; to { id } $argv
  ; to item [ get rails.by-id $id ]
  [ match
   { $item (
    ; to already-pinned [ propertyIs $item.lane rails.pinned-lane ]
    [ match
     { $already-pinned (
      !rails.hide-preview
      false
     ) }
     { true (
      !rails.pin $id
      true
     ) }
    ]
   ) }
  ]
 )

 !restore-btn.addEventListener mouseenter : !rails.activate-restore-btn
 !restore-btn.addEventListener mouseleave (
  ; to { ev } $argv
  ; condition { propertyIs null rails.pinned-lane } (
   ; to related [ match
    { $ev.relatedTarget : $ev.relatedTarget }
    { true : null }
   ]
   ; to active-item [ match
    { $rails.preview-lane : [ get rails.by-id $rails.preview-lane.id ] }
    { true : null }
   ]
   ; to to-icon [ match
    { $related (
     [ match
      { $active-item : !is-node-inside $active-item.icon-el $related }
      { true : false }
     ]
    ) }
    { true : false }
   ]
   ; condition { propertyIs false to-icon } : !rails.hide-preview
  )
 )
 !restore-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  ; to target-lane $rails.preview-lane
  [ match
   { $target-lane : !lane-control.restore $target-lane.id }
  ]
 )

 !preview-resizer.addEventListener mouseenter (
  ; set true rails.is-resizer-hover
  ; condition { propertyIs false rails.is-preview-resizing } : !sync-resizer-class
 )
 !preview-resizer.addEventListener mouseleave (
  ; set false rails.is-resizer-hover
  ; condition { propertyIs false rails.is-preview-resizing } : !sync-resizer-class
 )
 !preview-resizer.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
 )
 !preview-resizer.addEventListener mousedown (
  ; to { ev } $argv
  ; to active-lane $rails.preview-lane
  ; condition { and { $active-lane } { propertyIs true rails.is-preview-pinned } } (
   [ match
    { $ev.preventDefault : !ev.preventDefault }
   ]
   [ match
    { $ev.stopPropagation : !ev.stopPropagation }
   ]
   !finish-preview-resize false
   ; to side !resolve-active-preview-side $active-lane
   ; to raw-cx !resolve-num $ev.clientX
   ; to start-x [ match
    { [ propertyIs null raw-cx ] : 0 }
    { true : $raw-cx }
   ]
   ; to cw [ match
    { [ propertyIsGreaterThan 0 preview-el.clientWidth ] : !window.Math.round $preview-el.clientWidth }
    { true : null }
   ]
   ; to rect-w [ match
    { $preview-el.getBoundingClientRect (
     ; to rect !preview-el.getBoundingClientRect
     ; to rw !resolve-num $rect.width
     [ match
      { [ propertyIs null rw ] : null }
      { [ propertyIsGreaterThan 0 rw ] : !window.Math.round $rw }
      { true : null }
     ]
    ) }
    { true : null }
   ]
   ; to start-w [ match
    { $cw : $cw }
    { $rect-w : $rect-w }
    { [ propertyIsGreaterThan 0 active-lane.effective-width ] : $active-lane.effective-width }
    { [ propertyIsGreaterThan 0 active-lane.rendered-width ] : $active-lane.rendered-width }
    { true : 320 }
   ]
   ; to max-w [ match
    { [ propertyIsGreaterThanOrEqual 178 window.innerWidth ] : ; subtract $window.innerWidth 78 }
    { true : null }
   ]
   ; to has-modal [ propertyIs true active-lane.has-open-modal ]
   ; to has-modal-mw [ match
    { [ and { $has-modal } { propertyIsGreaterThan 0 active-lane.modal-min-width } ] : true }
    { true : false }
   ]
   ; to modal-min-w [ match
    { $has-modal-mw : $active-lane.modal-min-width }
    { $has-modal : $min-lane-modal-width }
    { true : 100 }
   ]
   ; to raw-min-w !window.Math.max 100 $modal-min-w
   ; to min-w [ match
    { $max-w : !window.Math.min $raw-min-w $max-w }
    { true : $raw-min-w }
   ]
   ; to prev-cursor [ match
    { $document.body.style.cursor : $document.body.style.cursor }
    { true : '' }
   ]
   ; set true rails.is-preview-resizing
   ; set true active-lane.is-resizing
   !sync-preview-classes $side true
   !sync-resizer-class $side
   [ match
    { $document.body.style : ; set ew-resize document.body.style.cursor }
   ]
   ; to drag ; object { start-x $start-x } { start-w $start-w } { side $side } { min-w $min-w } { max-w $max-w } { moved false } { next-w $start-w }
   ; to on-move (
    ; to { mev } $argv
    ; to raw-mx !resolve-num $mev.clientX
    ; to cur-x [ match
     { [ propertyIs null raw-mx ] : $drag.start-x }
     { true : $raw-mx }
    ]
    ; to delta [ match
     { [ propertyIs right drag.side ] : ; subtract $drag.start-x $cur-x }
     { true : ; subtract $cur-x $drag.start-x }
    ]
    ; to raw-next !window.Math.round ; add $drag.start-w $delta
    ; to floored !window.Math.max $drag.min-w $raw-next
    ; to clamped [ match
     { $drag.max-w : !window.Math.min $drag.max-w $floored }
     { true : $floored }
    ]
    ; set true drag.moved
    ; set $clamped drag.next-w
    [ match
     { $lane-control.apply-lane-width : !lane-control.apply-lane-width $active-lane $clamped }
     { true : !sync-preview-width $clamped $active-lane }
    ]
   )
   ; to teardown (
    ; to { save-flag } $argv
    ; set false rails.is-preview-resizing
    ; set false active-lane.is-resizing
    [ match
     { [ propertyIs $active-lane rails.preview-lane ] : !sync-preview-classes $drag.side $rails.is-preview-pinned }
    ]
    !sync-resizer-class $drag.side
    [ match
     { $document.body.style : ; set $prev-cursor document.body.style.cursor }
    ]
    [ match
     { $window.removeEventListener (
      !window.removeEventListener mousemove $on-move
      !window.removeEventListener mouseup $on-up
      !window.removeEventListener blur $on-blur
     ) }
    ]
    [ match
     { [ and { propertyIs true save-flag } { propertyIs true drag.moved } { $active-lane.data.set } ] : !active-lane.data.set width [ ; add '' $drag.next-w ] }
    ]
    !rails.sync-preview-resizer
   )
   ; to on-up : !finish-preview-resize true
   ; to on-blur : !finish-preview-resize true
   ; set $teardown rails.active-resize-cleanup
   [ match
    { $window.addEventListener (
     !window.addEventListener mousemove $on-move
     !window.addEventListener mouseup $on-up
     !window.addEventListener blur $on-blur
    ) }
   ]
  )
 )
 !preview-resizer.addEventListener dblclick (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  ; to active-lane $rails.preview-lane
  ; condition { and { $active-lane } { propertyIs true rails.is-preview-pinned } } (
   [ match
    { $lane-control.set-width : !lane-control.set-width $active-lane.id null }
    { true : !sync-preview-width null $active-lane }
   ]
  )
 )

 ; to rails.update (
  -- Refreshes a minimized lane's rail icon initial, accessible labels, and active preview width/restore labels
  ; to { lane } $argv
  [ match
   { $lane (
    ; to item [ get rails.by-id $lane.id ]
    [ match
     { $item (
      ; to initial !getLaneInitial $lane.title $lane.id
      ; set $initial item.icon-el.textContent
      ; set $lane.title item.icon-el.title
      ; to is-pinned [ propertyIs $lane rails.pinned-lane ]
      !item.icon-el.setAttribute aria-label [ ; add [ ternary $is-pinned 'Unpin ' 'Pin ' ] $lane.title ]
      [ match
       { [ propertyIs $lane rails.preview-lane ] (
        !sync-preview-width $lane.rendered-width $lane
        ; to restore-lbl ; add 'Restore ' $lane.title
        ; set $restore-lbl restore-btn.title
        !restore-btn.setAttribute aria-label $restore-lbl
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to rails.remove (
  -- Removes a minimized lane's icon from whichever rail holds it and hides its preview if active
  ; to { id } $argv
  [ match
   { $rails.preview-lane (
    ; condition { propertyIs $id rails.preview-lane.id } : !rails.hide-preview
   ) }
  ]
  ; to item [ get rails.by-id $id ]
  [ match
   { $item (
    !item.icon-el.remove
    ; to list [ ternary [ propertyIs left item.side ] $rails.left-items $rails.right-items ]
    ; to idx !list.indexOf $item
    ; condition { propertyIsGreaterThanOrEqual 0 idx } : !list.splice $idx 1
    !window.Reflect.deleteProperty $rails.by-id $id
   ) }
  ]
  $item
 )

 ; to rails.add (
  -- Adds or moves a minimized lane's 26px initial icon into the left or right rail
  ; to { lane raw-side } $argv
  ; to side !normalizeLaneMinimizeSide $raw-side
  [ match
   { $lane (
    [ match
     { $side (
      ; to existing [ get rails.by-id $lane.id ]
      [ match
       { $existing (
        [ match
         { [ propertyIs $side existing.side ] (
          !rails.update $lane
          $existing
         ) }
         { true (
          !rails.remove $lane.id
          !rails.add $lane $side
         ) }
        ]
       ) }
       { true (
        ; to initial !getLaneInitial $lane.title $lane.id
        ; to icon-el !document.createElement button
        ; assign $icon-el { type button } { className side-rail-icon } { textContent $initial } { title $lane.title }
        !icon-el.setAttribute data-lane-id $lane.id
        !icon-el.setAttribute data-rail-side $side
        !icon-el.setAttribute aria-label [ ; add 'Pin ' $lane.title ]
        !icon-el.setAttribute aria-pressed 'false'
        !icon-el.setAttribute aria-expanded 'false'
        !icon-el.addEventListener mouseenter (
         [ match
          { [ propertyIs null rails.pinned-lane ] : !rails.show-preview $lane $icon-el $side false }
          { [ propertyIs $lane rails.pinned-lane ] : !rails.activate-restore-btn $icon-el }
         ]
        )
        !icon-el.addEventListener mouseleave (
         ; to { ev } $argv
         ; condition { propertyIs null rails.pinned-lane } (
          ; to related [ match
           { $ev.relatedTarget : $ev.relatedTarget }
           { true : null }
          ]
          ; to to-restore [ match
           { $related : !is-node-inside $restore-btn $related }
           { true : false }
          ]
          ; condition { propertyIs false to-restore } (
           ; condition { propertyIs $lane rails.preview-lane } : !rails.hide-preview
          )
         )
        )
        !icon-el.addEventListener click (
         ; to { ev } $argv
         [ match
          { $ev.stopPropagation : !ev.stopPropagation }
         ]
         !rails.toggle-pin $lane.id
        )
        ; to target-rail [ ternary [ propertyIs left side ] $left-rail $right-rail ]
        ; to target-nav [ ternary [ propertyIs left side ] $prev-nav $next-nav ]
        ; to target-list [ ternary [ propertyIs left side ] $rails.left-items $rails.right-items ]
        !restore-node $target-rail $icon-el $target-nav
        ; to item [ object { lane $lane } { side $side } { icon-el $icon-el } { restore-btn $restore-btn } { pinned false } ]
        !target-list.push $item
        ; to rails.by-id $lane.id $item
        $item
       ) }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to rails.clear (
  -- Clears all minimized rail icons and hides any active hover preview
  !rails.hide-preview
  [ match
   { $rails.close-chip-menu : !rails.close-chip-menu }
  ]
  [ match
   { $rails.close-clock-menu : !rails.close-clock-menu }
  ]
  ; while { propertyIsGreaterThan 0 rails.left-items.length } (
   ; to item !rails.left-items.pop
   !item.icon-el.remove
  )
  ; while { propertyIsGreaterThan 0 rails.right-items.length } (
   ; to item !rails.right-items.pop
   !item.icon-el.remove
  )
  ; to rails.by-id ; object
 )

 ; to is-fullscreen (
  -- Returns true when the document is currently in fullscreen mode
  [ match
   { $document.fullscreenElement : true }
   { $document.webkitFullscreenElement : true }
   { true : false }
  ]
 )

 ; to resolve-clock-format-opts (
  ; to raw-hr $lane-control.clock-hour-format
  ; to hr-fmt [ match
   { $normalizeClockHourFormat : !normalizeClockHourFormat $raw-hr $window.Intl }
   { [ propertyIs '24h' raw-hr ] : '24h' }
   { [ propertyIs '24' raw-hr ] : '24h' }
   { true : '12h' }
  ]
  ; to raw-sec $lane-control.clock-show-seconds
  ; to show-sec [ match
   { $normalizeClockShowSeconds : !normalizeClockShowSeconds $raw-sec }
   { [ propertyIs false raw-sec ] : false }
   { [ propertyIs 'false' raw-sec ] : false }
   { true : true }
  ]
  ; object { hourFormat $hr-fmt } { showSeconds $show-sec }
 )

 ; to resolve-clock-now (
  ; to { raw-now } $argv
  [ match
   { [ propertyIs null raw-now ] : [ match { $window.Date.now : !window.Date.now } { true : 0 } ] }
   { [ propertyIs undefined raw-now ] : [ match { $window.Date.now : !window.Date.now } { true : 0 } ] }
   { true : $raw-now }
  ]
 )

 ; to build-clock-options-fallback (
  ; to { tz-list } $argv
  ; to browser-tz [ match
   { $getBrowserTimeZone : !getBrowserTimeZone $window.Intl }
   { true : UTC }
  ]
  ; to b-lbl ; add 'Browser (' ; add $browser-tz ')'
  ; to out {
   [ object { id browser } { value browser } { timeZone $browser-tz } { label $b-lbl } { shortLabel $browser-tz } { offset UTC } { previewTime '' } { isBrowser true } { isUtc false } { isConfigured false } ]
   [ object { id UTC } { value UTC } { timeZone UTC } { label UTC } { shortLabel UTC } { offset 'UTC+00:00' } { previewTime '' } { isBrowser false } { isUtc true } { isConfigured false } ]
  }
  ; to list [ match { [ !window.Array.isArray $tz-list ] : $tz-list } { true : {} } ]
  ; each $list (
   ; to { tz } $argv
   ; to clean [ match { $tz.trim : !tz.trim } { true : '' } ]
   ; to is-utc [ propertyIs UTC clean ]
   ; condition { and { propertyIsGreaterThan 0 clean.length } { propertyIs false is-utc } } (
    !out.push [ object { id $clean } { value $clean } { timeZone $clean } { label $clean } { shortLabel $clean } { offset '' } { previewTime '' } { isBrowser false } { isUtc false } { isConfigured true } ]
   )
  )
  $out
 )

 ; to resolve-clock-options (
  ; to { now-val } $argv
  ; to fmt-opts !resolve-clock-format-opts
  [ match
   { $buildTopRailTimezoneOptions : !buildTopRailTimezoneOptions $rails.clock-timezones [ object { intl $window.Intl } { now $now-val } { hourFormat $fmt-opts.hourFormat } { showSeconds $fmt-opts.showSeconds } ] }
   { true : !build-clock-options-fallback $rails.clock-timezones }
  ]
 )

 ; to resolve-active-clock-opt (
  ; to { opts } $argv
  ; to raw-sel [ match
   { $lane-control.clock-timezone : $lane-control.clock-timezone }
   { true : browser }
  ]
  [ match
   { $resolveActiveClockTimezone : !resolveActiveClockTimezone $raw-sel $opts $window.Intl }
   { true (
    ; to clean-sel [ match { $raw-sel.trim : !raw-sel.trim } { true : browser } ]
    ; to found ; object { opt [ get opts 0 ] }
    ; each $opts (
     ; to { cand } $argv
     ; condition { propertyIs $clean-sel cand.value } : ; set $cand found.opt
    )
    $found.opt
   ) }
  ]
 )

 ; to rails.sync-chip-menu (
  -- Syncs the chip popover dropdown title and Last synced timestamp with the currently active chip
  ; to item $rails.active-chip-item
  [ match
   { $item (
    ; to lookup-row [ match
     { $lane-control.get-top-rail-chip-row : !lane-control.get-top-rail-chip-row $item }
     { true : null }
    ]
    ; to raw-title [ match
     { $lookup-row.title : $lookup-row.title }
     { $item.title : $item.title }
     { $item.row.title : $item.row.title }
     { $item.label : $item.label }
     { $item.text : $item.text }
     { $item.url : $item.url }
     { true : Chip }
    ]
    ; to title-str ; add '' $raw-title
    ; set $title-str chip-menu-title-el.textContent
    ; set $title-str chip-menu-title-el.title
    ; to raw-fetched [ match
     { $lookup-row.fetched : $lookup-row.fetched }
     { $item.fetched : $item.fetched }
     { $item.row.fetched : $item.row.fetched }
     { $item.lastSynced : $item.lastSynced }
     { $item.syncedAt : $item.syncedAt }
     { true : '' }
    ]
    ; to fmt-opts !resolve-clock-format-opts
    ; to disp-opts [ match
     { $lane-control.get-clock-display-options : !lane-control.get-clock-display-options }
     { true (
      ; to now-val !resolve-clock-now
      ; to tz-opts !resolve-clock-options $now-val
      ; to act-opt !resolve-active-clock-opt $tz-opts
      [ object
       { timeZone [ match { $act-opt.timeZone : $act-opt.timeZone } { true : UTC } ] }
       { hourFormat $fmt-opts.hourFormat }
       { showTimeZone true }
       { intl $window.Intl }
      ]
     ) }
    ]
    ; to ts-opts ; object { timeZone $disp-opts.timeZone } { hourFormat $disp-opts.hourFormat } { showTimeZone true } { intl $window.Intl }
    ; to ts-info [ match
     { [ and $raw-fetched $formatLineTimestamp ] : !formatLineTimestamp $raw-fetched $ts-opts }
     { true : ; object { known false } { display Never } { iso '' } }
    ]
    ; to synced-display [ match
     { [ propertyIs true ts-info.known ] : $ts-info.display }
     { $raw-fetched : ; add '' $raw-fetched }
     { true : Never }
    ]
    ; to synced-txt ; add 'Last synced: ' $synced-display
    ; set $synced-txt chip-menu-synced-el.textContent
    ; set [ match { $ts-info.iso : $ts-info.iso } { true : $synced-display } ] chip-menu-synced-el.title
   ) }
  ]
 )

 ; to rails.close-chip-menu (
  -- Closes the top-rail chip popover dropdown
  ; set true chip-menu.hidden
  ; set false rails.is-chip-menu-open
  [ match
   { $rails.active-chip-el (
    ; set top-rail-chip rails.active-chip-el.className
    [ match
     { $rails.active-chip-el.setAttribute : !rails.active-chip-el.setAttribute aria-expanded 'false' }
    ]
   ) }
  ]
  ; set null rails.active-chip-el
  ; set null rails.active-chip-item
  ; set -1 rails.active-chip-index
 )

 ; to position-chip-menu (
  -- Centers the chip popover dropdown horizontally beneath the target chip element
  ; to { chip-el } $argv
  [ match
   { $chip-el.getBoundingClientRect (
    ; to rect !chip-el.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to center-x !window.Math.round ; add $rect.left $half
      [ match
       { $chip-menu.style : ; set [ ; add $center-x px ] chip-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to rails.open-chip-menu (
  -- Opens the chip popover dropdown anchored below the clicked top-rail chip
  ; to { chip-el chip-item chip-idx } $argv
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-preferences-menu
  !rails.close-clock-menu
  [ match
   { $rails.active-chip-el (
    ; set top-rail-chip rails.active-chip-el.className
    [ match
     { $rails.active-chip-el.setAttribute : !rails.active-chip-el.setAttribute aria-expanded 'false' }
    ]
   ) }
  ]
  ; set $chip-el rails.active-chip-el
  ; set $chip-item rails.active-chip-item
  ; set $chip-idx rails.active-chip-index
  ; set true rails.is-chip-menu-open
  ; set Copy chip-copy-btn.textContent
  [ match
   { $chip-el (
    ; set 'top-rail-chip top-rail-chip--active' chip-el.className
    [ match
     { $chip-el.setAttribute : !chip-el.setAttribute aria-expanded 'true' }
    ]
    !position-chip-menu $chip-el
   ) }
  ]
  !rails.sync-chip-menu
  ; set false chip-menu.hidden
 )

 ; to rails.toggle-chip-menu (
  -- Toggles the chip popover dropdown for a top-rail chip
  ; to { chip-el chip-item chip-idx } $argv
  [ match
   { [ and $rails.is-chip-menu-open [ propertyIs $chip-el rails.active-chip-el ] ] : !rails.close-chip-menu }
   { true : !rails.open-chip-menu $chip-el $chip-item $chip-idx }
  ]
 )

 ; to attach-chip-interaction (
  -- Wires popover dropdown click and keyboard interaction onto a top-rail chip element
  ; to { span chip-obj chip-idx } $argv
  !span.setAttribute role button
  !span.setAttribute tabindex '0'
  !span.setAttribute aria-haspopup dialog
  !span.setAttribute aria-expanded 'false'
  !span.addEventListener click (
   ; to { ev } $argv
   [ match
    { $ev.stopPropagation : !ev.stopPropagation }
   ]
   !rails.toggle-chip-menu $span $chip-obj $chip-idx
  )
  !span.addEventListener keydown (
   ; to { ev } $argv
   ; to is-act [ match
    { [ propertyIs Enter ev.key ] : true }
    { [ propertyIs ' ' ev.key ] : true }
    { true : false }
   ]
   ; condition { propertyIs true is-act } (
    [ match
     { $ev.preventDefault : !ev.preventDefault }
    ]
    [ match
     { $ev.stopPropagation : !ev.stopPropagation }
    ]
    !rails.toggle-chip-menu $span $chip-obj $chip-idx
   )
  )
  !rails.top-chip-items.push ; object { el $span } { item $chip-obj } { index $chip-idx }
 )

 ; to append-before-clock (
  -- Inserts a top-rail chip before clock-btn so clock-btn always remains the final element on the far right of all chips
  ; to { node } $argv
  [ match
   { $top-rail.insertBefore : !top-rail.insertBefore $node $clock-btn }
   { true (
    [ match
     { $top-rail.children.indexOf (
      ; to c-idx !top-rail.children.indexOf $clock-btn
      ; condition { propertyIsGreaterThanOrEqual 0 c-idx } : !top-rail.children.splice $c-idx 1
     ) }
    ]
    !top-rail.appendChild $node
    !top-rail.appendChild $clock-btn
   ) }
  ]
 )

 ; to compute-chip-rail-id (
  -- Computes a unique canonical chip:<id> key for a top-rail element
  ; to { item idx seen-map } $argv
  ; to base-id [ match
   { $resolveTopRailElementId : !resolveTopRailElementId $item $idx }
   { [ and $item $item.railId ] : ; add '' $item.railId }
   { [ and $item $item.id ] ( ; to s ; add '' $item.id , [ ternary [ !s.startsWith 'chip:' ] $s [ ; add 'chip:' $s ] ] ) }
   { [ and $item $item.title ] : ; add 'chip:' $item.title }
   { [ and $item $item.trim ] : ; add 'chip:' $item }
   { true : ; add 'chip:' $idx }
  ]
  ; to cand ; object { id $base-id } { n 2 }
  ; while { get seen-map $cand.id } (
   ; set [ ; add $base-id ; add '#' $cand.n ] cand.id
   ; set [ ; add $cand.n 1 ] cand.n
  )
  ; to seen-map $cand.id true
  $cand.id
 )

 ; to rails.apply-top-layout (
  -- Applies interface.rails.top.order and interface.rails.top.hidden to all built-in top-rail controls, chips, and clock
  ; to elem-specs {}
  ; to node-by-id [ object
   { fullscreen $fullscreen-btn }
   { search $search-btn }
   { session $session-btn }
   { packages $packages-btn }
   { servers $servers-btn }
   { preferences $preferences-btn }
   { clock $clock-btn }
  ]
  ; each $rails.top-element-nodes (
   ; to { entry } $argv
   ; to node-by-id $entry.id $entry.el
   ; to item-hid [ match { [ and $entry.item [ propertyIs true entry.item.hidden ] ] : true } { true : false } ]
   !elem-specs.push [ object { railId $entry.id } { hidden $item-hid } ]
  )
  ; to layout [ match
   { $resolveTopRailLayout : !resolveTopRailLayout [ object { elements $elem-specs } { order $rails.top-order } { hidden $rails.top-hidden } ] }
   { true (
    ; to def-ids { fullscreen search session packages servers preferences }
    ; each $elem-specs ( ; to { es } $argv , !def-ids.push $es.railId )
    !def-ids.push clock
    ; to valid-map ; object
    ; each $def-ids ( ; to { did } $argv , ; to valid-map $did true )
    ; to ord-ids {}
    ; to placed ; object
    [ match
     { [ and [ !window.Array.isArray $rails.top-order ] [ propertyIsGreaterThan 0 rails.top-order.length ] ] (
      ; each $rails.top-order (
       ; to { raw-id } $argv
       ; to cid [ match { $raw-id.trim : !raw-id.trim } { $raw-id : ; add '' $raw-id } { true : '' } ]
       ; to alr [ ternary [ get placed $cid ] true false ]
       ; condition { and { get valid-map $cid } { propertyIs false alr } } (
        ; to placed $cid true
        !ord-ids.push $cid
       )
      )
      ; each $def-ids (
       ; to { did } $argv
       ; to alr-d [ ternary [ get placed $did ] true false ]
       ; condition { propertyIs false alr-d } (
        ; to placed $did true
        !ord-ids.push $did
       )
      )
     ) }
     { true : ; set $def-ids ord-ids }
    ]
    ; to hid-ids {}
    ; to hid-seen ; object
    [ match
     { [ !window.Array.isArray $rails.top-hidden ] (
      ; each $rails.top-hidden (
       ; to { rh } $argv
       ; to ch [ match { $rh.trim : !rh.trim } { $rh : ; add '' $rh } { true : '' } ]
       ; to alr-h [ ternary [ get hid-seen $ch ] true false ]
       ; condition { and { propertyIsGreaterThan 0 ch.length } { propertyIs false alr-h } } (
        ; to hid-seen $ch true
        !hid-ids.push $ch
       )
      )
     ) }
    ]
    ; each $elem-specs (
     ; to { es } $argv
     ; to alr-eh [ ternary [ get hid-seen $es.railId ] true false ]
     ; condition { and { propertyIs true es.hidden } { propertyIs false alr-eh } } (
      ; to hid-seen $es.railId true
      !hid-ids.push $es.railId
     )
    )
    ; object { orderedIds $ord-ids } { hiddenIds $hid-ids }
   ) }
  ]
  ; to hidden-map ; object
  ; each $layout.hiddenIds (
   ; to { hid } $argv
   ; to hidden-map $hid true
  )
  ; to all-ids { fullscreen search session packages servers preferences clock }
  ; each $rails.top-element-nodes ( ; to { entry } $argv , !all-ids.push $entry.id )
  ; each $all-ids (
   ; to { aid } $argv
   ; to node [ get node-by-id $aid ]
   ; to is-hid [ ternary [ get hidden-map $aid ] true false ]
   [ match
    { $node : ; set $is-hid node.hidden }
   ]
  )
  ; condition { and { get hidden-map session } { propertyIs true rails.is-session-open } } : !rails.close-session-menu
  ; condition { and { get hidden-map packages } { propertyIs true rails.is-packages-open } } : !rails.close-packages-menu
  ; condition { and { get hidden-map preferences } { propertyIs true rails.is-preferences-open } } : !rails.close-preferences-menu
  ; condition { and { get hidden-map clock } { propertyIs true rails.is-clock-open } } : !rails.close-clock-menu
  ; condition { and { propertyIs true rails.is-chip-menu-open } { $rails.active-chip-el } { propertyIs true rails.active-chip-el.hidden } } : !rails.close-chip-menu
  ; each $layout.orderedIds (
   ; to { oid } $argv
   ; to node [ get node-by-id $oid ]
   [ match
    { $node (
     [ match
      { $top-rail.children.indexOf (
       ; to prev-idx !top-rail.children.indexOf $node
       ; condition { propertyIsGreaterThanOrEqual 0 prev-idx } : !top-rail.children.splice $prev-idx 1
      ) }
     ]
     !top-rail.appendChild $node
    ) }
   ]
  )
  $layout
 )

 ; to rails.set-top-layout (
  -- Updates top-rail item ordering and hidden item IDs and re-applies layout immediately
  ; to { raw-order raw-hidden } $argv
  ; to next-ord [ match
   { $normalizeTopRailOrder : !normalizeTopRailOrder $raw-order }
   { [ !window.Array.isArray $raw-order ] : $raw-order }
   { true : {} }
  ]
  ; to next-hid [ match
   { $normalizeTopRailHidden : !normalizeTopRailHidden $raw-hidden }
   { [ !window.Array.isArray $raw-hidden ] : $raw-hidden }
   { true : {} }
  ]
  ; set $next-ord rails.top-order
  ; set $next-hid rails.top-hidden
  !rails.apply-top-layout
 )

 ; to rails.set-top-elements (
  -- Replaces custom elements rendered inside the top rail row and applies configured top-rail order and visibility
  ; to { raw-elements } $argv
  ; to was-chip-open $rails.is-chip-menu-open
  ; to prev-chip-item $rails.active-chip-item
  ; to prev-chip-idx $rails.active-chip-index
  ; while { propertyIsGreaterThan 0 rails.top-elements.length } (
   ; to prev-el !rails.top-elements.pop
   [ match
    { $prev-el.remove : !prev-el.remove }
   ]
   [ match
    { $top-rail.children.indexOf (
     ; to prev-idx !top-rail.children.indexOf $prev-el
     ; condition { propertyIsGreaterThanOrEqual 0 prev-idx } : !top-rail.children.splice $prev-idx 1
    ) }
   ]
  )
  ; set 0 rails.top-element-nodes.length
  ; set 0 rails.top-chip-items.length
  ; to chip-id-seen ; object
  ; to list [ match
   { [ !window.Array.isArray $raw-elements ] : $raw-elements }
   { true : {} }
  ]
  ; each $list (
   ; to { item item-idx } $argv
   [ match
    { [ and $item $item.appendChild ] (
     ; to rail-id !compute-chip-rail-id $item $item-idx $chip-id-seen
     [ match { $item.setAttribute : !item.setAttribute data-rail-id $rail-id } ]
     !append-before-clock $item
     !rails.top-elements.push $item
     !rails.top-element-nodes.push [ object { id $rail-id } { el $item } { item $item } ]
    ) }
    { [ and $item $item.trim ] (
     ; to rail-id !compute-chip-rail-id $item $item-idx $chip-id-seen
     ; to span !document.createElement span
     ; assign $span { className top-rail-chip } { textContent $item }
     [ match { $span.setAttribute : !span.setAttribute data-rail-id $rail-id } ]
     ; to str-obj ; object { title $item } { text $item } { value $item } { fetched '' } { railId $rail-id }
     !attach-chip-interaction $span $str-obj $item-idx
     !append-before-clock $span
     !rails.top-elements.push $span
     !rails.top-element-nodes.push [ object { id $rail-id } { el $span } { item $str-obj } ]
    ) }
    { $item (
     ; to raw-text [ match
      { $item.text : $item.text }
      { $item.label : $item.label }
      { $item.value : $item.value }
      { true : '' }
     ]
     ; to text-str ; add '' $raw-text
     [ match
      { [ propertyIs '' text-str ] : null }
      { true (
       ; to rail-id !compute-chip-rail-id $item $item-idx $chip-id-seen
       ; to span !document.createElement span
       ; assign $span { className top-rail-chip } { textContent $text-str }
       [ match { $span.setAttribute : !span.setAttribute data-rail-id $rail-id } ]
       ; to bg-color [ match
        { $item.color : $item.color }
        { $item.backgroundColor : $item.backgroundColor }
        { true : '' }
       ]
       [ match
        { $bg-color (
         ; set $bg-color span.style.backgroundColor
         ; set #ffffff span.style.color
        ) }
       ]
       [ match
        { $item.borderColor : ; set $item.borderColor span.style.borderColor }
       ]
       [ match
        { $item.title : ; set $item.title span.title }
       ]
       !attach-chip-interaction $span $item $item-idx
       !append-before-clock $span
       !rails.top-elements.push $span
       !rails.top-element-nodes.push [ object { id $rail-id } { el $span } { item $item } ]
      ) }
     ]
    ) }
   ]
  )
  !rails.apply-top-layout
  ; condition { propertyIs true was-chip-open } (
   ; to prev-url [ match
    { $prev-chip-item.url.trim : !prev-chip-item.url.trim }
    { true : '' }
   ]
   ; to prev-title [ match
    { $prev-chip-item.title.trim : !prev-chip-item.title.trim }
    { true : '' }
   ]
   ; to rebound ; object { entry null }
   ; each $rails.top-chip-items (
    ; to { entry } $argv
    ; condition { propertyIs null rebound.entry } (
     ; to cur-url [ match
      { $entry.item.url.trim : !entry.item.url.trim }
      { true : '' }
     ]
     ; to cur-title [ match
      { $entry.item.title.trim : !entry.item.title.trim }
      { true : '' }
     ]
     ; to hit [ match
      { [ and { propertyIsGreaterThan 0 prev-url.length } { propertyIs $prev-url cur-url } ] : true }
      { [ and { propertyIsGreaterThan 0 prev-title.length } { propertyIs $prev-title cur-title } ] : true }
      { [ propertyIs $prev-chip-idx entry.index ] : true }
      { true : false }
     ]
     ; condition { propertyIs true hit } : ; set $entry rebound.entry
    )
   )
   [ match
    { $rebound.entry (
     ; set $rebound.entry.el rails.active-chip-el
     ; set $rebound.entry.item rails.active-chip-item
     ; set $rebound.entry.index rails.active-chip-index
     ; set 'top-rail-chip top-rail-chip--active' rebound.entry.el.className
     [ match
      { $rebound.entry.el.setAttribute : !rebound.entry.el.setAttribute aria-expanded 'true' }
     ]
     !position-chip-menu $rebound.entry.el
     !rails.sync-chip-menu
    ) }
    { true : !rails.close-chip-menu }
   ]
  )
  $rails.top-elements
 )

 ; to rails.sync-fullscreen (
  -- Syncs the top-rail fullscreen button icon and accessibility attributes with current fullscreen state
  ; to active !is-fullscreen
  ; set $active rails.is-fullscreen
  ; to label [ ternary $active 'Exit full screen' 'Full screen' ]
  ; to icon-html [ ternary $active $fs-exit-svg $fs-enter-svg ]
  ; assign $fullscreen-btn { innerHTML $icon-html } { title $label }
  !fullscreen-btn.setAttribute aria-label $label
  !fullscreen-btn.setAttribute aria-pressed [ ternary $active 'true' 'false' ]
  !fullscreen-btn.setAttribute data-fullscreen [ ternary $active 'true' 'false' ]
  $active
 )

 ; to rails.toggle-fullscreen (
  -- Toggles fullscreen on the root html element (document.documentElement) and syncs the corner icon (requires exiting lane fullscreen first)
  ; to has-lane-fs [ match
   { $lane-control.fullscreen-lane : true }
   { true : false }
  ]
  ; condition { propertyIs false has-lane-fs } (
   ; to active !is-fullscreen
   ; try (
    [ match
     { $active (
      [ match
       { $document.exitFullscreen : !document.exitFullscreen }
       { $document.webkitExitFullscreen : !document.webkitExitFullscreen }
      ]
     ) }
     { true (
      ; to root $document.documentElement
      [ match
       { $root (
        [ match
         { $root.requestFullscreen : !root.requestFullscreen }
         { $root.webkitRequestFullscreen : !root.webkitRequestFullscreen }
        ]
       ) }
      ]
     ) }
    ]
   ) : null
  )
  !rails.sync-fullscreen
 )

 ; to sync-session-btn-class (
  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; to dirty [ and { propertyIs false pending } { propertyIs true lane-control.session-dirty } ]
  ; to base [ match
   { $rails.is-session-open : 'top-rail-icon top-rail-icon--session top-rail-icon--active' }
   { true : 'top-rail-icon top-rail-icon--session' }
  ]
  ; to next-cls [ match
   { $pending : ; add $base ' top-rail-icon--pending' }
   { $dirty : ; add $base ' top-rail-icon--dirty' }
   { true : $base }
  ]
  ; set $next-cls session-btn.className
 )

 ; to rails.sync-session-menu (
  -- Syncs the dedicated Sessions dropdown status, draft Save/Fork/Abandon row, and 1-click recent sessions
  ; to sid $lane-control.session-id
  ; to sname [ match
   { $lane-control.session-meta.name : $lane-control.session-meta.name }
   { $sid : $sid }
   { true : Session }
  ]
  ; to ver [ match
   { $lane-control.session-meta.version : ; add v $lane-control.session-meta.version }
   { true : v1 }
  ]
  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; to dirty [ and { propertyIs false pending } { propertyIs true lane-control.session-dirty } ]
  ; to blocked [ match { $pending : true } { $dirty : true } { true : false } ]
  ; to pending-lbl [ match
   { [ propertyIs '' lane-control.session-status-label ] : 'Loading…' }
   { $lane-control.session-status-label : $lane-control.session-status-label }
   { true : 'Loading…' }
  ]
  ; to status-txt [ match
   { $pending : ; add $sname ; add ' · ' ; add $ver ; add ' (' ; add $pending-lbl ')' }
   { $dirty : ; add $sname ; add ' · ' ; add $ver '* (unsaved)' }
   { true : ; add $sname ; add ' · ' $ver }
  ]
  ; to status-ttl [ match
   { $sid : ; add $sname ; add ' (' ; add $sid ')' }
   { true : Session }
  ]
  ; set $status-txt session-status-el.textContent
  ; set $status-ttl session-status-el.title
  ; to dir-confirmed [ propertyIs true lane-control.session-data-dir-confirmed ]
  ; to dir-label [ match
   { $lane-control.format-data-dir-label : !lane-control.format-data-dir-label $lane-control.session-data-dir $dir-confirmed }
   { $lane-control.session-data-dir : $lane-control.session-data-dir }
   { [ propertyIs true dir-confirmed ] : Default }
   { true : 'Default (unconfirmed)' }
  ]
  ; to dir-ttl [ match
   { $dir-confirmed : ; add 'Permanent data directory: ' $dir-label }
   { true : 'Data directory not confirmed — click to select or confirm Default' }
  ]
  ; set $dir-label session-dir-el.textContent
  ; set $dir-ttl session-dir-el.title
  ; set [ ternary $dir-confirmed top-rail-menu-dir 'top-rail-menu-dir top-rail-menu-dir--unconfirmed' ] session-dir-el.className
  ; set [ ternary $blocked false true ] session-draft-row.hidden
  ; set [ ternary $pending 'workspace-session-draft workspace-session-draft--pending' workspace-session-draft ] session-draft-row.className
  ; set [ ternary $pending $pending-lbl 'Unsaved version' ] session-draft-label.textContent
  ; set $pending session-draft-actions.hidden
  ; set $blocked session-new-btn.disabled
  !session-new-btn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
  !sync-session-btn-class

  ; while { propertyIsGreaterThan 0 rails.session-recent-els.length } (
   ; to old-el !rails.session-recent-els.pop
   !old-el.remove
  )
  ; set 0 rails.session-recent-items.length

  ; to recents [ match
   { $lane-control.recent-sessions : $lane-control.recent-sessions }
   { true : {} }
  ]
  ; to shown ; object { count 0 }
  ; each $recents (
   ; to { rec } $argv
   ; to is-cur [ propertyIs $sid rec.id ]
   ; condition { propertyIs false is-cur } (
    ; condition { propertyIsLessThan 5 shown.count } (
     ; set [ ; add $shown.count 1 ] shown.count
     ; to rec-name [ match { $rec.name : $rec.name } { true : $rec.id } ]
     ; to rec-dir [ match
      { $lane-control.format-data-dir-label : !lane-control.format-data-dir-label $rec.dataDir $rec.dataDirConfirmed }
      { $rec.dataDir : $rec.dataDir }
      { [ propertyIs true rec.dataDirConfirmed ] : Default }
      { true : 'Default (unconfirmed)' }
     ]
     ; to rbtn !document.createElement button
     ; to rbtn-title [ match
      { $pending : ; add $pending-lbl ; add ' — wait before switching to ' ; add $rec.id ; add ' (' ; add $rec-dir ')' }
      { $dirty : ; add 'Resolve unsaved version (Save, Fork, or Abandon) before switching to ' ; add $rec.id ; add ' (' ; add $rec-dir ')' }
      { true : ; add 'Switch to ' ; add $rec.id ; add ' (' ; add $rec-dir ')' }
     ]
     ; assign $rbtn { type button } { className 'top-rail-menu-item top-rail-menu-session-item' } { title $rbtn-title } { disabled $blocked }
     !rbtn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
     ; to rname !document.createElement span
     ; assign $rname { className top-rail-menu-session-name } { textContent $rec-name }
     ; to rdir !document.createElement span
     ; assign $rdir { className top-rail-menu-session-dir } { textContent $rec-dir }
     !rbtn.appendChild $rname
     !rbtn.appendChild $rdir
     !rbtn.setAttribute role menuitem
     !rbtn.addEventListener click (
      ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
       !rails.close-session-menu
       [ match
        { $lane-control.switch-session : !lane-control.switch-session $rec.id }
       ]
      )
     )
     !session-recent-el.appendChild $rbtn
     !rails.session-recent-els.push $rbtn
     !rails.session-recent-items.push ; object { rec $rec } { btn $rbtn } { name-el $rname } { dir-el $rdir }
    )
   )
  )
  ; to has-recents [ propertyIsGreaterThan 0 shown.count ]
  ; set [ ternary $has-recents false true ] session-recent-div.hidden
  ; set [ ternary $has-recents false true ] session-recent-title.hidden
 )

 ; to rails.close-session-menu (
  -- Closes the Sessions dropdown menu
  ; set true session-menu.hidden
  ; set false rails.is-session-open
  !sync-session-btn-class
  !session-btn.setAttribute aria-expanded 'false'
 )

 ; to rails.open-session-menu (
  -- Opens the Sessions dropdown menu anchored under the session button
  !rails.close-packages-menu
  !rails.close-preferences-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  [ match
   { $lane-control.ensure-session : !lane-control.ensure-session }
  ]
  ; set true rails.is-session-open
  !rails.sync-session-menu
  [ match
   { $session-btn.getBoundingClientRect (
    ; to rect !session-btn.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to center-x !window.Math.round ; add $rect.left $half
      [ match
       { $session-menu.style : ; set [ ; add $center-x px ] session-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
  ; set false session-menu.hidden
  !session-btn.setAttribute aria-expanded 'true'
 )

 ; to rails.toggle-session-menu (
  -- Toggles the Sessions dropdown menu open or closed
  [ match
   { $rails.is-session-open : !rails.close-session-menu }
   { true : !rails.open-session-menu }
  ]
 )

 ; to rails.sync-packages-menu (
  -- Syncs the dedicated Packages dropdown with the current session's included packages
  ; while { propertyIsGreaterThan 0 rails.pkg-els.length } (
   ; to old-el !rails.pkg-els.pop
   !old-el.remove
  )
  ; set 0 rails.pkg-items.length

  ; to pkgs [ match
   { $lane-control.open-packages : $lane-control.open-packages }
   { true : {} }
  ]
  ; each $pkgs (
   ; to { pkg } $argv
   ; to row !document.createElement div
   ; set top-rail-menu-pkg-row row.className
   ; to is-active [ propertyIs $lane-control.active-package-id pkg.id ]
   ; to dot-btn !document.createElement button
   ; assign $dot-btn { type button } { className [ ternary $is-active 'top-rail-menu-pkg-dot top-rail-menu-pkg-dot--active' top-rail-menu-pkg-dot ] } { textContent [ ternary $is-active '●' '○' ] } { title [ ternary $is-active 'Active package' 'Set active package' ] }
   !dot-btn.addEventListener click (
    [ match
     { $lane-control.set-active-package : !lane-control.set-active-package $pkg.id }
    ]
   )
   ; to btn-cls [ ternary $is-active 'top-rail-menu-item top-rail-menu-pkg-btn top-rail-menu-pkg-btn--active' 'top-rail-menu-item top-rail-menu-pkg-btn' ]
   ; to pkg-btn !document.createElement button
   ; assign $pkg-btn { type button } { className $btn-cls } { textContent $pkg.name } { title [ ; add 'Open package page: ' $pkg.id ] }
   !pkg-btn.setAttribute role menuitem
   !pkg-btn.addEventListener click (
    !rails.close-packages-menu
    [ match
     { $lane-control.package-modal.open-packages : !lane-control.package-modal.open-packages $pkg.id }
    ]
   )
   ; to close-pkg-btn !document.createElement button
   ; assign $close-pkg-btn { type button } { className top-rail-menu-pkg-close } { textContent '×' } { title [ ; add 'Close package ' $pkg.name ] }
   !close-pkg-btn.setAttribute aria-label [ ; add 'Close package ' $pkg.name ]
   !close-pkg-btn.addEventListener click (
    [ match
     { $lane-control.close-package : !lane-control.close-package $pkg.id }
    ]
   )
   !row.appendChild $dot-btn
   !row.appendChild $pkg-btn
   !row.appendChild $close-pkg-btn
   !pkg-menu-list.appendChild $row
   !rails.pkg-els.push $row
   !rails.pkg-items.push ; object { pkg $pkg } { row $row } { dot-btn $dot-btn } { btn $pkg-btn } { close-btn $close-pkg-btn } { active $is-active }
  )
 )

 ; to rails.close-packages-menu (
  -- Closes the Packages dropdown menu
  ; set true packages-menu.hidden
  ; set false rails.is-packages-open
  ; set 'top-rail-icon top-rail-icon--packages' packages-btn.className
  !packages-btn.setAttribute aria-expanded 'false'
 )

 ; to rails.open-packages-menu (
  -- Opens the Packages dropdown menu anchored under the packages button
  !rails.close-session-menu
  !rails.close-preferences-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  [ match
   { $lane-control.ensure-session : !lane-control.ensure-session }
  ]
  !rails.sync-packages-menu
  [ match
   { $packages-btn.getBoundingClientRect (
    ; to rect !packages-btn.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to center-x !window.Math.round ; add $rect.left $half
      [ match
       { $packages-menu.style : ; set [ ; add $center-x px ] packages-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
  ; set false packages-menu.hidden
  ; set true rails.is-packages-open
  ; set 'top-rail-icon top-rail-icon--packages top-rail-icon--active' packages-btn.className
  !packages-btn.setAttribute aria-expanded 'true'
 )

 ; to rails.toggle-packages-menu (
  -- Toggles the Packages dropdown menu open or closed
  [ match
   { $rails.is-packages-open : !rails.close-packages-menu }
   { true : !rails.open-packages-menu }
  ]
 )

 ; to rails.sync-preferences-menu (
  -- Syncs the preferences dropdown label and Open preferences lane visibility with global active preferences lane
  ; to pref-id $lane-control.preferences-lane-id
  [ match
   { $pref-id (
    ; to pref-title [ match
     { $lane-control.get-lane-title : !lane-control.get-lane-title $pref-id }
     { true : $pref-id }
    ]
    ; to status-txt ; add 'Preferences: ' $pref-title
    ; to status-ttl ; add $pref-title ; add ' (' ; add $pref-id ')'
    ; set $status-txt pref-status-el.textContent
    ; set $status-ttl pref-status-el.title
    ; set false pref-open-btn.hidden
   ) }
   { true (
    ; set 'No preferences lane set' pref-status-el.textContent
    ; set '' pref-status-el.title
    ; set true pref-open-btn.hidden
   ) }
  ]
 )

 ; to rails.close-preferences-menu (
  -- Closes the preferences dropdown menu
  ; set true pref-menu.hidden
  ; set false rails.is-preferences-open
  ; set 'top-rail-icon top-rail-icon--preferences' preferences-btn.className
  !preferences-btn.setAttribute aria-expanded 'false'
 )

 ; to rails.open-preferences-menu (
  -- Refreshes and opens the preferences dropdown menu anchored under the wrench button
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  [ match
   { $lane-control.load-catalog : !lane-control.load-catalog }
  ]
  !rails.sync-preferences-menu
  [ match
   { $preferences-btn.getBoundingClientRect (
    ; to rect !preferences-btn.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to center-x !window.Math.round ; add $rect.left $half
      [ match
       { $pref-menu.style : ; set [ ; add $center-x px ] pref-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
  ; set false pref-menu.hidden
  ; set true rails.is-preferences-open
  ; set 'top-rail-icon top-rail-icon--preferences top-rail-icon--active' preferences-btn.className
  !preferences-btn.setAttribute aria-expanded 'true'
 )

 ; to rails.toggle-preferences-menu (
  -- Toggles the preferences dropdown menu open or closed
  [ match
   { $rails.is-preferences-open : !rails.close-preferences-menu }
   { true : !rails.open-preferences-menu }
  ]
 )

 ; to rails.close-prev-nav (
  -- Collapses the left-rail Previous sessions flyout menu
  ; set true prev-nav-menu.hidden
  ; set false rails.is-prev-nav-open
  ; set false rails.prev-nav-hover
  ; set side-rail-nav-tab prev-nav-tab.className
  !prev-nav-tab.setAttribute aria-expanded 'false'
 )

 ; to rails.open-prev-nav (
  -- Expands the left-rail Previous sessions flyout menu when destinations are available
  ; to { from-hover } $argv
  ; condition { propertyIsGreaterThan 0 rails.prev-nav-items.length } (
   !rails.close-next-nav
   !rails.hide-preview
   ; set false prev-nav-menu.hidden
   ; set true rails.is-prev-nav-open
   ; set [ ternary $from-hover true false ] rails.prev-nav-hover
   ; set 'side-rail-nav-tab side-rail-nav-tab--open' prev-nav-tab.className
   !prev-nav-tab.setAttribute aria-expanded 'true'
  )
 )

 ; to rails.close-next-nav (
  -- Collapses the right-rail Next sessions flyout menu
  ; set true next-nav-menu.hidden
  ; set false rails.is-next-nav-open
  ; set false rails.next-nav-hover
  ; set side-rail-nav-tab next-nav-tab.className
  !next-nav-tab.setAttribute aria-expanded 'false'
 )

 ; to rails.open-next-nav (
  -- Expands the right-rail Next sessions flyout menu when destinations are available
  ; to { from-hover } $argv
  ; condition { propertyIsGreaterThan 0 rails.next-nav-items.length } (
   !rails.close-prev-nav
   !rails.hide-preview
   ; set false next-nav-menu.hidden
   ; set true rails.is-next-nav-open
   ; set [ ternary $from-hover true false ] rails.next-nav-hover
   ; set 'side-rail-nav-tab side-rail-nav-tab--open' next-nav-tab.className
   !next-nav-tab.setAttribute aria-expanded 'true'
  )
 )

 ; to rails.close-session-nav (
  -- Collapses both left-rail Previous and right-rail Next session navigation flyouts
  !rails.close-prev-nav
  !rails.close-next-nav
 )

 ; to render-nav-side (
  -- Syncs one side rail's centered session arrow tab, unsaved-version block, and flyout list with currently available destinations
  ; to { side sessions nav-el tab-el count-el draft-el draft-lbl-el draft-acts-el list-el els-store items-store close-fn } $argv
  ; while { propertyIsGreaterThan 0 els-store.length } (
   ; to old-el !els-store.pop
   !old-el.remove
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
  ; to list [ match { $sessions : $sessions } { true : {} } ]
  ; to count $list.length
  [ match
   { [ propertyIs 0 count ] (
    !close-fn
    ; set true nav-el.hidden
    ; set true draft-el.hidden
    ; set '' count-el.textContent
    ; set true count-el.hidden
   ) }
   { true (
    ; set false nav-el.hidden
    ; set [ ternary $blocked false true ] draft-el.hidden
    ; set [ ternary $pending 'workspace-session-draft workspace-session-draft--pending' workspace-session-draft ] draft-el.className
    [ match
     { $draft-lbl-el : ; set [ ternary $pending $pending-lbl 'Unsaved version' ] draft-lbl-el.textContent }
    ]
    [ match
     { $draft-acts-el : ; set $pending draft-acts-el.hidden }
    ]
    ; to label-prefix [ ternary [ propertyIs left side ] 'Previous sessions' 'Next sessions' ]
    ; to label-txt ; add $label-prefix ; add ' (' ; add $count ')'
    ; set $label-txt tab-el.title
    !tab-el.setAttribute aria-label $label-txt
    ; to show-count [ propertyIsGreaterThan 1 count ]
    ; set [ ternary $show-count [ ; add '' $count ] '' ] count-el.textContent
    ; set [ ternary $show-count false true ] count-el.hidden

    ; each $list (
     ; to { item } $argv
     ; to display-name [ match { $item.name : $item.name } { true : $item.id } ]
     ; to dir-lbl [ match
      { $lane-control.format-data-dir-label : !lane-control.format-data-dir-label $item.dataDir $item.dataDirConfirmed }
      { $item.dataDir : $item.dataDir }
      { [ propertyIs true item.dataDirConfirmed ] : Default }
      { true : '' }
     ]
     ; to btn !document.createElement button
     ; to btn-cls [ ternary $blocked 'side-rail-nav-item side-rail-nav-item--disabled' side-rail-nav-item ]
     ; to btn-title [ match
      { $pending : ; add $pending-lbl ; add ' — wait before switching to ' ; add $display-name ; add ' (' ; add $item.id ')' }
      { $dirty : ; add 'Resolve unsaved version (Save, Fork, or Abandon) before switching to ' ; add $display-name ; add ' (' ; add $item.id ')' }
      { true : ; add 'Switch to ' ; add $display-name ; add ' (' ; add $item.id ')' }
     ]
     ; assign $btn { type button } { className $btn-cls } { title $btn-title } { disabled $blocked }
     !btn.setAttribute role menuitem
     !btn.setAttribute data-session-id $item.id
     !btn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
     ; to name-el !document.createElement span
     ; assign $name-el { className side-rail-nav-item-name } { textContent $display-name }
     !btn.appendChild $name-el
     ; to meta-txt [ match
      { [ propertyIs '' dir-lbl ] : $item.id }
      { true : $dir-lbl }
     ]
     ; to meta-el !document.createElement span
     ; assign $meta-el { className side-rail-nav-item-meta } { textContent $meta-txt }
     !btn.appendChild $meta-el
     !btn.addEventListener click (
      ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
       !rails.close-session-nav
       [ match
        { $lane-control.switch-session : !lane-control.switch-session $item.id }
       ]
      )
     )
     !list-el.appendChild $btn
     !els-store.push $btn
     !items-store.push ; object { session $item } { btn $btn } { name-el $name-el } { meta-el $meta-el }
    )
   ) }
  ]
 )

 ; to rails.sync-session-nav (
  -- Updates the left (Previous) and right (Next) centered rail arrow tabs from available linked sessions
  !render-nav-side left $lane-control.available-previous-sessions $prev-nav $prev-nav-tab $prev-nav-count $prev-nav-draft $prev-nav-draft-label $prev-nav-draft-actions $prev-nav-list $rails.prev-nav-els $rails.prev-nav-items $rails.close-prev-nav
  !render-nav-side right $lane-control.available-next-sessions $next-nav $next-nav-tab $next-nav-count $next-nav-draft $next-nav-draft-label $next-nav-draft-actions $next-nav-list $rails.next-nav-els $rails.next-nav-items $rails.close-next-nav
 )

 ; to format-clock-display (
  ; to { now-val active-opt } $argv
  ; to fmt-opts !resolve-clock-format-opts
  [ match
   { $formatTopRailClock : !formatTopRailClock $now-val $active-opt $window.Intl $fmt-opts }
   { true (
    ; to tz-lbl [ match { $active-opt.shortLabel : $active-opt.shortLabel } { $active-opt.timeZone : $active-opt.timeZone } { true : UTC } ]
    ; to dt [ match
     { $window.Reflect.construct : !window.Reflect.construct $window.Date { $now-val } }
     { true : null }
    ]
    ; to iso [ match { $dt.toISOString : !dt.toISOString } { true : '1970-01-01T00:00:00.000Z' } ]
    ; to end-idx [ ternary $fmt-opts.showSeconds 19 16 ]
    ; to hhmmss !iso.slice 11 $end-idx
    ; to chip-txt ; add $hhmmss ; add ' ' $tz-lbl
    ; object { chipText $chip-txt } { fullText $chip-txt } { timeZone $active-opt.timeZone } { label $active-opt.label } { shortZone $tz-lbl } { offset [ match { $active-opt.offset : $active-opt.offset } { true : UTC } ] } { hourFormat $fmt-opts.hourFormat } { showSeconds $fmt-opts.showSeconds } { iso $iso }
   ) }
  ]
 )

 ; to position-clock-menu (
  -- Positions the clock dropdown beneath clock-btn while clamping inside viewport edges
  [ match
   { $clock-btn.getBoundingClientRect (
    ; to rect !clock-btn.getBoundingClientRect
    [ match
     { [ propertyIsGreaterThan 0 rect.width ] (
      ; to half ; divide $rect.width 2
      ; to raw-x !window.Math.round ; add $rect.left $half
      ; to vw [ match { [ propertyIsGreaterThan 0 window.innerWidth ] : $window.innerWidth } { true : 0 } ]
      ; to clamped-x [ match
       { [ propertyIsGreaterThan 360 vw ] (
        ; to max-x ; subtract $vw 176
        ; to min-x 176
        ; to hi !window.Math.min $raw-x $max-x
        !window.Math.max $min-x $hi
       ) }
       { true : $raw-x }
      ]
      [ match
       { $clock-menu.style : ; set [ ; add $clamped-x px ] clock-menu.style.left }
      ]
     ) }
    ]
   ) }
  ]
 )

 ; to rails.render-clock-options (
  -- Renders the searchable, selectable timezone list inside the top-rail clock popover
  ; to { raw-now } $argv
  ; to now-val !resolve-clock-now $raw-now
  ; to opts !resolve-clock-options $now-val
  ; set $opts rails.clock-options
  ; to active-opt !resolve-active-clock-opt $opts
  ; set $active-opt rails.clock-active-option

  ; while { propertyIsGreaterThan 0 rails.clock-option-els.length } (
   ; to prev-entry !rails.clock-option-els.pop
   [ match
    { $prev-entry.btn.remove : !prev-entry.btn.remove }
   ]
  )

  ; to query [ match { $rails.clock-search-query : $rails.clock-search-query } { true : '' } ]
  ; to filtered [ match
   { $filterTimezoneOptions : !filterTimezoneOptions $opts $query }
   { true (
    ; to q-trim [ match { $query.trim ( ; to t !query.trim , !t.toLowerCase ) } { true : '' } ]
    [ match
     { [ propertyIs '' q-trim ] : $opts }
     { true (
      ; to f-out {}
      ; each $opts (
       ; to { o } $argv
       ; to hay ; add [ match { $o.label : $o.label } { true : '' } ] ; add ' ' [ match { $o.timeZone : $o.timeZone } { true : '' } ]
       ; to hay-low !hay.toLowerCase
       ; to is-hit !hay-low.includes $q-trim
       ; condition { propertyIs true is-hit } : !f-out.push $o
      )
      $f-out
     ) }
    ]
   ) }
  ]
  ; set $filtered rails.clock-filtered-options

  ; to cfg-count $rails.clock-timezones.length
  ; to hint-txt [ match
   { [ propertyIs 0 cfg-count ] : 'Browser & UTC only (none in Preferences)' }
   { [ propertyIs 1 cfg-count ] : 'Browser, UTC + 1 timezone from Preferences' }
   { true : ; add 'Browser, UTC + ' ; add $cfg-count ' timezones from Preferences' }
  ]
  ; set $hint-txt clock-hint-el.textContent

  ; to has-pref [ match { $lane-control.preferences-lane-id : true } { true : false } ]
  ; set [ ternary $has-pref false true ] clock-footer-el.hidden

  ; to has-matches [ propertyIsGreaterThan 0 filtered.length ]
  ; set [ ternary $has-matches true false ] clock-empty-el.hidden
  ; set [ ternary $has-matches false true ] clock-list-el.hidden

  ; each $filtered (
   ; to { opt } $argv
   ; to is-sel [ propertyIs $active-opt.value opt.value ]
   ; to btn !document.createElement button
   ; to cls [ ternary $is-sel 'top-rail-clock-option top-rail-clock-option--active' top-rail-clock-option ]
   ; assign $btn { type button } { className $cls } { title $opt.timeZone }
   !btn.setAttribute role option
   !btn.setAttribute aria-selected [ ternary $is-sel 'true' 'false' ]
   !btn.setAttribute data-timezone $opt.value

   ; to dot-el !document.createElement span
   ; assign $dot-el { className top-rail-clock-option-dot } { textContent [ ternary $is-sel '●' '○' ] }

   ; to name-el !document.createElement span
   ; assign $name-el { className top-rail-clock-option-name } { textContent $opt.label }

   ; to meta-txt [ match
    { [ and $opt.previewTime $opt.offset ] : ; add $opt.previewTime ; add ' · ' $opt.offset }
    { $opt.offset : $opt.offset }
    { true : $opt.shortLabel }
   ]
   ; to meta-el !document.createElement span
   ; assign $meta-el { className top-rail-clock-option-meta } { textContent $meta-txt }

   !btn.appendChild $dot-el
   !btn.appendChild $name-el
   !btn.appendChild $meta-el
   !btn.addEventListener click (
    ; to { ev } $argv
    [ match
     { $ev.stopPropagation : !ev.stopPropagation }
    ]
    !rails.select-clock-timezone $opt.value
   )
   !clock-list-el.appendChild $btn
   !rails.clock-option-els.push ; object { opt $opt } { btn $btn } { dot-el $dot-el } { name-el $name-el } { meta-el $meta-el }
  )
  $filtered
 )

 ; to rails.sync-clock-prefs-ui (
  -- Syncs the 12h/24h buttons and Show seconds checkbox inside the clock popover
  ; to fmt-opts !resolve-clock-format-opts
  ; to is-12 [ propertyIs '12h' fmt-opts.hourFormat ]
  ; to is-24 [ propertyIs '24h' fmt-opts.hourFormat ]
  ; set [ ternary $is-12 'top-rail-clock-hour-btn top-rail-clock-hour-btn--active' top-rail-clock-hour-btn ] clock-12h-btn.className
  ; set [ ternary $is-24 'top-rail-clock-hour-btn top-rail-clock-hour-btn--active' top-rail-clock-hour-btn ] clock-24h-btn.className
  !clock-12h-btn.setAttribute aria-pressed [ ternary $is-12 'true' 'false' ]
  !clock-24h-btn.setAttribute aria-pressed [ ternary $is-24 'true' 'false' ]
  ; set $fmt-opts.showSeconds clock-seconds-check.checked
  $fmt-opts
 )

 ; to rails.sync-clock (
  -- Updates the top-rail clock button text, tooltip, and open popover live header/previews
  ; to { raw-now } $argv
  !rails.sync-clock-prefs-ui
  ; to now-val !resolve-clock-now $raw-now
  ; to opts !resolve-clock-options $now-val
  ; set $opts rails.clock-options
  ; to active-opt !resolve-active-clock-opt $opts
  ; set $active-opt rails.clock-active-option
  ; to fmt !format-clock-display $now-val $active-opt
  ; set $fmt.chipText clock-btn.textContent
  ; to btn-ttl ; add $fmt.fullText ; add ' — ' $fmt.label
  ; set $btn-ttl clock-btn.title
  !clock-btn.setAttribute aria-label [ ; add 'Current time: ' $btn-ttl ]
  ; condition { propertyIs true rails.is-clock-open } (
   ; set $fmt.fullText clock-full-time-el.textContent
   ; to sub-txt [ match
    { $fmt.offset : ; add $fmt.label ; add ' · ' $fmt.offset }
    { true : $fmt.label }
   ]
   ; set $sub-txt clock-active-tz-el.textContent
   ; to opt-by-val ; object
   ; each $opts (
    ; to { o } $argv
    ; to opt-by-val $o.value $o
   )
   ; each $rails.clock-option-els (
    ; to { entry } $argv
    ; to fresh [ get opt-by-val $entry.opt.value ]
    [ match
     { $fresh (
      ; to m-txt [ match
       { [ and $fresh.previewTime $fresh.offset ] : ; add $fresh.previewTime ; add ' · ' $fresh.offset }
       { $fresh.offset : $fresh.offset }
       { true : $fresh.shortLabel }
      ]
      ; set $m-txt entry.meta-el.textContent
     ) }
    ]
   )
  )
  $fmt
 )

 ; to rails.set-timezones (
  -- Updates the list of configured timezone names from preferences.timezones and refreshes the clock
  ; to { raw-timezones } $argv
  ; to clean-list [ match
   { $extractTimezoneNames : !extractTimezoneNames $raw-timezones $window.Intl }
   { [ !window.Array.isArray $raw-timezones ] (
    ; to out {}
    ; to seen ; object
    ; each $raw-timezones (
     ; to { item } $argv
     ; to nm [ match { $item.trim : !item.trim } { $item.name.trim : !item.name.trim } { true : '' } ]
     ; to dup [ ternary [ get seen $nm ] true false ]
     ; condition { and { propertyIsGreaterThan 0 nm.length } { propertyIs false dup } } (
      ; to seen $nm true
      !out.push $nm
     )
    )
    $out
   ) }
   { true : {} }
  ]
  ; set $clean-list rails.clock-timezones
  !rails.sync-clock
  ; condition { propertyIs true rails.is-clock-open } : !rails.render-clock-options
  ; condition { propertyIs true rails.is-chip-menu-open } : !rails.sync-chip-menu
  $clean-list
 )

 ; to rails.close-clock-menu (
  -- Closes the top-rail clock & timezone selector popover
  ; set true clock-menu.hidden
  ; set false rails.is-clock-open
  ; set 'top-rail-chip top-rail-clock' clock-btn.className
  !clock-btn.setAttribute aria-expanded 'false'
 )

 ; to rails.open-clock-menu (
  -- Refreshes preferences timezones and opens the searchable timezone selector popover under clock-btn
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-preferences-menu
  !rails.close-chip-menu
  [ match
   { $lane-control.sync-preferences-timezones : !lane-control.sync-preferences-timezones }
  ]
  ; set '' rails.clock-search-query
  ; set '' clock-search-input.value
  ; set true rails.is-clock-open
  ; set 'top-rail-chip top-rail-clock top-rail-chip--active' clock-btn.className
  !clock-btn.setAttribute aria-expanded 'true'
  !rails.sync-clock
  !rails.render-clock-options
  !position-clock-menu
  ; set false clock-menu.hidden
  [ match
   { $clock-search-input.focus : !clock-search-input.focus }
  ]
 )

 ; to rails.toggle-clock-menu (
  -- Toggles the top-rail clock & timezone selector popover open or closed
  [ match
   { $rails.is-clock-open : !rails.close-clock-menu }
   { true : !rails.open-clock-menu }
  ]
 )

 ; to rails.select-clock-timezone (
  -- Selects an active timezone for the top-rail clock, persists it, and closes the popover
  ; to { tz-val } $argv
  [ match
   { $lane-control.set-clock-timezone : !lane-control.set-clock-timezone $tz-val }
   { true (
    ; set $tz-val lane-control.clock-timezone
    !rails.sync-clock
    ; condition { propertyIs true rails.is-chip-menu-open } : !rails.sync-chip-menu
   ) }
  ]
  !rails.close-clock-menu
  $tz-val
 )

 ; to rails.set-clock-hour-format (
  -- Updates 12h/24h preference from the clock popover without closing the popover
  ; to { hr-fmt } $argv
  [ match
   { $lane-control.set-clock-hour-format : !lane-control.set-clock-hour-format $hr-fmt }
   { true (
    ; set $hr-fmt lane-control.clock-hour-format
    !rails.sync-clock
    ; condition { propertyIs true rails.is-clock-open } : !rails.render-clock-options
    ; condition { propertyIs true rails.is-chip-menu-open } : !rails.sync-chip-menu
   ) }
  ]
  $hr-fmt
 )

 ; to rails.set-clock-show-seconds (
  -- Updates Show seconds preference from the clock popover without closing the popover
  ; to { show-sec } $argv
  ; to clean-sec [ ternary $show-sec true false ]
  [ match
   { $lane-control.set-clock-show-seconds : !lane-control.set-clock-show-seconds $clean-sec }
   { true (
    ; set $clean-sec lane-control.clock-show-seconds
    !rails.sync-clock
    ; condition { propertyIs true rails.is-clock-open } : !rails.render-clock-options
   ) }
  ]
  $clean-sec
 )

 !fullscreen-btn.addEventListener click (
  !rails.close-preferences-menu
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  !rails.toggle-fullscreen
 )
 !search-btn.addEventListener click (
  !rails.close-preferences-menu
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  [ match
   { $lane-control.lane-modal.open : !lane-control.lane-modal.open }
  ]
 )
 !session-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.toggle-session-menu
 )
 !session-save-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.save-session-draft : !lane-control.save-session-draft }
  ]
 )
 !session-draft-fork-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.fork-session : !lane-control.fork-session }
  ]
 )
 !session-abandon-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.abandon-session-draft : !lane-control.abandon-session-draft }
  ]
 )
 !prev-nav-save-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.save-session-draft : !lane-control.save-session-draft }
  ]
 )
 !prev-nav-fork-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.fork-session : !lane-control.fork-session }
  ]
 )
 !prev-nav-abandon-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.abandon-session-draft : !lane-control.abandon-session-draft }
  ]
 )
 !next-nav-save-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.save-session-draft : !lane-control.save-session-draft }
  ]
 )
 !next-nav-fork-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.fork-session : !lane-control.fork-session }
  ]
 )
 !next-nav-abandon-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.abandon-session-draft : !lane-control.abandon-session-draft }
  ]
 )
 !session-dir-el.addEventListener click (
  !rails.close-session-menu
  [ match
   { [ propertyIs false lane-control.session-data-dir-confirmed ] (
    [ match
     { $lane-control.dir-modal.open-confirm : !lane-control.dir-modal.open-confirm }
    ]
   ) }
   { $lane-control.session-modal.open-switch-session : !lane-control.session-modal.open-switch-session }
  ]
 )
 !session-new-btn.addEventListener click (
  ; condition { and { propertyIs false lane-control.session-status-pending } { propertyIs false lane-control.session-dirty } } (
   !rails.close-session-menu
   [ match
    { $lane-control.prompt-new-session : !lane-control.prompt-new-session false }
    { $lane-control.new-session : !lane-control.new-session }
   ]
  )
 )
 !session-fork-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.fork-session : !lane-control.fork-session }
  ]
 )
 !session-manage-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.session-modal.open-switch-session : !lane-control.session-modal.open-switch-session }
  ]
 )
 !session-history-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.session-modal.open-history : !lane-control.session-modal.open-history }
  ]
 )
 !session-copy-btn.addEventListener click (
  !rails.close-session-menu
  [ match
   { $lane-control.copy-agent-context : !lane-control.copy-agent-context }
  ]
 )
 !packages-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.toggle-packages-menu
 )
 !pkg-create-btn.addEventListener click (
  !rails.close-packages-menu
  [ match
   { $lane-control.package-modal.open-create-package : !lane-control.package-modal.open-create-package }
  ]
 )
 !pkg-open-btn.addEventListener click (
  !rails.close-packages-menu
  [ match
   { $lane-control.package-modal.open-unlock-package : !lane-control.package-modal.open-unlock-package }
  ]
 )
 !pkg-page-btn.addEventListener click (
  !rails.close-packages-menu
  [ match
   { $lane-control.package-modal.open-packages : !lane-control.package-modal.open-packages }
  ]
 )
 !servers-btn.addEventListener click (
  !rails.close-preferences-menu
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  [ match
   { $lane-control.servers-modal.open : !lane-control.servers-modal.open servers }
  ]
 )
 !clock-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.toggle-clock-menu
 )
 !clock-12h-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.set-clock-hour-format '12h'
 )
 !clock-24h-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.set-clock-hour-format '24h'
 )
 !clock-seconds-check.addEventListener change (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.set-clock-show-seconds $clock-seconds-check.checked
 )
 !clock-search-input.addEventListener input (
  ; set $clock-search-input.value rails.clock-search-query
  !rails.render-clock-options
 )
 !clock-search-input.addEventListener keydown (
  ; to { ev } $argv
  [ match
   { [ propertyIs Enter ev.key ] (
    [ match
     { $ev.preventDefault : !ev.preventDefault }
    ]
    ; condition { propertyIsGreaterThan 0 rails.clock-filtered-options.length } (
     ; to first-opt [ get rails.clock-filtered-options 0 ]
     !rails.select-clock-timezone $first-opt.value
    )
   ) }
   { [ propertyIs Escape ev.key ] (
    [ match
     { $ev.stopPropagation : !ev.stopPropagation }
    ]
    !rails.close-clock-menu
   ) }
  ]
 )
 !clock-manage-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.close-clock-menu
  [ match
   { $lane-control.open-preferences-timezones-view : !lane-control.open-preferences-timezones-view }
   { $lane-control.open-preferences-lane : !lane-control.open-preferences-lane }
  ]
 )
 !chip-sync-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  ; to item $rails.active-chip-item
  [ match
   { $item (
    ; set true chip-sync-btn.disabled
    ; set 'Syncing…' chip-sync-btn.textContent
    ; try (
     [ match
      { $lane-control.sync-top-rail-chip : !lane-control.sync-top-rail-chip $item }
     ]
    ) : null
    ; set false chip-sync-btn.disabled
    ; set 'Sync now' chip-sync-btn.textContent
    !rails.sync-chip-menu
   ) }
  ]
 )
 !chip-copy-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  ; to item $rails.active-chip-item
  [ match
   { $item (
    ; to row-obj [ match
     { $lane-control.get-top-rail-chip-row : !lane-control.get-top-rail-chip-row $item }
     { $item.row : $item.row }
     { true : $item }
    ]
    ; to json-txt [ match
     { $window.JSON.stringify : !window.JSON.stringify $row-obj null 2 }
     { true : ; add '' $row-obj }
    ]
    [ match
     { $window.navigator.clipboard.writeText : !window.navigator.clipboard.writeText $json-txt }
    ]
    ; set 'Copied!' chip-copy-btn.textContent
   ) }
  ]
 )
 !preferences-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  !rails.toggle-preferences-menu
 )
 !pref-open-btn.addEventListener click (
  !rails.close-preferences-menu
  [ match
   { $lane-control.open-preferences-lane : !lane-control.open-preferences-lane }
  ]
 )
 !pref-set-btn.addEventListener click (
  !rails.close-preferences-menu
  [ match
   { $lane-control.pick-lane (
    ; to pick-opts [ object
     { title 'Set Preferences Lane' }
     { current-value $lane-control.preferences-lane-id }
     { on-select (
      ; to { chosen-id } $argv
      [ match
       { $lane-control.set-preferences-lane : !lane-control.set-preferences-lane $chosen-id }
      ]
     ) }
    ]
    !lane-control.pick-lane $pick-opts
   ) }
  ]
 )
 !pref-create-btn.addEventListener click (
  !rails.close-preferences-menu
  [ match
   { $lane-control.create-preferences-lane : !lane-control.create-preferences-lane }
  ]
 )
 !prev-nav.addEventListener mouseenter (
  ; condition { propertyIs false rails.is-prev-nav-open } : !rails.open-prev-nav true
 )
 !prev-nav.addEventListener mouseleave : !rails.close-prev-nav
 !prev-nav-tab.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { [ propertyIs false rails.is-prev-nav-open ] : !rails.open-prev-nav false }
   { [ propertyIs true rails.prev-nav-hover ] : ; set false rails.prev-nav-hover }
   { true : !rails.close-prev-nav }
  ]
 )
 !next-nav.addEventListener mouseenter (
  ; condition { propertyIs false rails.is-next-nav-open } : !rails.open-next-nav true
 )
 !next-nav.addEventListener mouseleave : !rails.close-next-nav
 !next-nav-tab.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { [ propertyIs false rails.is-next-nav-open ] : !rails.open-next-nav false }
   { [ propertyIs true rails.next-nav-hover ] : ; set false rails.next-nav-hover }
   { true : !rails.close-next-nav }
  ]
 )
 [ match
  { $document.addEventListener (
   !document.addEventListener fullscreenchange $rails.sync-fullscreen
   !document.addEventListener webkitfullscreenchange $rails.sync-fullscreen
   !document.addEventListener click (
    ; to { ev } $argv
    ; to target [ match
     { $ev.target : $ev.target }
     { true : null }
    ]
    ; condition { propertyIs true rails.is-preferences-open } (
     ; to in-menu [ match
      { $target : !is-node-inside $pref-menu $target }
      { true : false }
     ]
     ; to in-btn [ match
      { $target : !is-node-inside $preferences-btn $target }
      { true : false }
     ]
     ; condition { propertyIs false in-menu } (
      ; condition { propertyIs false in-btn } : !rails.close-preferences-menu
     )
    )
    ; condition { propertyIs true rails.is-session-open } (
     ; to in-smenu [ match
      { $target : !is-node-inside $session-menu $target }
      { true : false }
     ]
     ; to in-sbtn [ match
      { $target : !is-node-inside $session-btn $target }
      { true : false }
     ]
     ; condition { propertyIs false in-smenu } (
      ; condition { propertyIs false in-sbtn } : !rails.close-session-menu
     )
    )
    ; condition { propertyIs true rails.is-packages-open } (
     ; to in-pmenu [ match
      { $target : !is-node-inside $packages-menu $target }
      { true : false }
     ]
     ; to in-pbtn [ match
      { $target : !is-node-inside $packages-btn $target }
      { true : false }
     ]
     ; condition { propertyIs false in-pmenu } (
      ; condition { propertyIs false in-pbtn } : !rails.close-packages-menu
     )
    )
    ; condition { propertyIs true rails.is-chip-menu-open } (
     ; to in-cmenu [ match
      { $target : !is-node-inside $chip-menu $target }
      { true : false }
     ]
     ; to in-cbtn [ match
      { [ and { $target } { $rails.active-chip-el } ] : !is-node-inside $rails.active-chip-el $target }
      { true : false }
     ]
     ; condition { propertyIs false in-cmenu } (
      ; condition { propertyIs false in-cbtn } : !rails.close-chip-menu
     )
    )
    ; condition { propertyIs true rails.is-clock-open } (
     ; to in-kmenu [ match
      { $target : !is-node-inside $clock-menu $target }
      { true : false }
     ]
     ; to in-kbtn [ match
      { $target : !is-node-inside $clock-btn $target }
      { true : false }
     ]
     ; condition { propertyIs false in-kmenu } (
      ; condition { propertyIs false in-kbtn } : !rails.close-clock-menu
     )
    )
    ; condition { propertyIs true rails.is-prev-nav-open } (
     ; to in-prev-nav [ match
      { $target : !is-node-inside $prev-nav $target }
      { true : false }
     ]
     ; condition { propertyIs false in-prev-nav } : !rails.close-prev-nav
    )
    ; condition { propertyIs true rails.is-next-nav-open } (
     ; to in-next-nav [ match
      { $target : !is-node-inside $next-nav $target }
      { true : false }
     ]
     ; condition { propertyIs false in-next-nav } : !rails.close-next-nav
    )
   )
  ) }
 ]
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs Escape ev.key } (
     ; condition { propertyIs true rails.is-preferences-open } : !rails.close-preferences-menu
     ; condition { propertyIs true rails.is-session-open } : !rails.close-session-menu
     ; condition { propertyIs true rails.is-packages-open } : !rails.close-packages-menu
     ; condition { propertyIs true rails.is-chip-menu-open } : !rails.close-chip-menu
     ; condition { propertyIs true rails.is-clock-open } : !rails.close-clock-menu
     ; condition { propertyIs true rails.is-prev-nav-open } : !rails.close-prev-nav
     ; condition { propertyIs true rails.is-next-nav-open } : !rails.close-next-nav
    )
   )
   !window.addEventListener resize (
    ; condition { and { $rails.preview-lane } { propertyIs true rails.is-preview-pinned } } : !rails.sync-preview-resizer
   )
  ) }
 ]
 [ match
  { $window.ResizeObserver (
   ; try (
    ; to preview-ro !window.Reflect.construct $window.ResizeObserver { (
     ; condition { and { $rails.preview-lane } { propertyIs true rails.is-preview-pinned } } : !rails.sync-preview-resizer
    ) }
    !preview-ro.observe $preview-el
    !preview-ro.observe $preview-frame
   ) : null
  ) }
 ]
 [ match
  { $window.setInterval (
   ; to c-timer !window.setInterval (
    !rails.sync-clock
   ) 1000
   ; set $c-timer rails.clock-timer
  ) }
 ]
 !rails.sync-fullscreen
 !rails.sync-session-menu
 !rails.sync-packages-menu
 !rails.sync-preferences-menu
 !rails.sync-session-nav
 !rails.sync-clock

 $rails
)
$scope
