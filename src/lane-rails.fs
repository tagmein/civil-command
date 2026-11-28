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

 ; to pkg-menu-loading-el !document.createElement div
 ; assign $pkg-menu-loading-el { className 'cc-loading cc-loading--compact' } { textContent 'Loading packages…' } { hidden true }

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
 !packages-menu.appendChild $pkg-menu-loading-el
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

 ; to minimap-el !document.createElement aside
 ; assign $minimap-el { className lane-minimap } { hidden true }
 !minimap-el.setAttribute role region
 !minimap-el.setAttribute aria-label 'Workspace minimap'

 ; to minimap-scale-handle !document.createElement div
 ; assign $minimap-scale-handle { className lane-minimap-scale-handle } { title 'Drag to scale minimap (double-click to reset)' }
 !minimap-scale-handle.setAttribute role separator
 !minimap-scale-handle.setAttribute aria-label 'Drag to scale minimap'

 ; to minimap-header !document.createElement div
 ; set lane-minimap-header minimap-header.className

 ; to minimap-title-el !document.createElement span
 ; assign $minimap-title-el { className lane-minimap-title } { textContent Minimap }

 ; to minimap-controls !document.createElement div
 ; set lane-minimap-controls minimap-controls.className

 ; to minimap-zoom-out-btn !document.createElement button
 ; assign $minimap-zoom-out-btn { type button } { className lane-minimap-btn } { textContent '−' } { title 'Scale down minimap' }
 !minimap-zoom-out-btn.setAttribute aria-label 'Scale down minimap'

 ; to minimap-zoom-reset-btn !document.createElement button
 ; assign $minimap-zoom-reset-btn { type button } { className 'lane-minimap-btn lane-minimap-scale-readout' } { textContent '100%' } { title 'Reset minimap scale to 100%' }
 !minimap-zoom-reset-btn.setAttribute aria-label 'Reset minimap scale'

 ; to minimap-zoom-in-btn !document.createElement button
 ; assign $minimap-zoom-in-btn { type button } { className lane-minimap-btn } { textContent '+' } { title 'Scale up minimap' }
 !minimap-zoom-in-btn.setAttribute aria-label 'Scale up minimap'

 ; to minimap-close-btn !document.createElement button
 ; assign $minimap-close-btn { type button } { className 'lane-minimap-btn lane-minimap-btn--close' } { textContent '×' } { title 'Hide minimap' }
 !minimap-close-btn.setAttribute aria-label 'Hide minimap'

 !minimap-controls.appendChild $minimap-zoom-out-btn
 !minimap-controls.appendChild $minimap-zoom-reset-btn
 !minimap-controls.appendChild $minimap-zoom-in-btn
 !minimap-controls.appendChild $minimap-close-btn
 !minimap-header.appendChild $minimap-title-el
 !minimap-header.appendChild $minimap-controls

 ; to minimap-stage !document.createElement div
 ; assign $minimap-stage { className lane-minimap-stage } { title 'Click or drag to scroll viewport' }

 ; to minimap-lanes-layer !document.createElement div
 ; set lane-minimap-lanes minimap-lanes-layer.className

 ; to minimap-viewport-el !document.createElement div
 ; assign $minimap-viewport-el { className lane-minimap-viewport } { title 'Drag viewport to scroll' }

 !minimap-stage.appendChild $minimap-lanes-layer
 !minimap-stage.appendChild $minimap-viewport-el
 !minimap-el.appendChild $minimap-scale-handle
 !minimap-el.appendChild $minimap-header
 !minimap-el.appendChild $minimap-stage

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
   !document.body.appendChild $minimap-el
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
  { pkg-menu-loading-el $pkg-menu-loading-el }
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
  { chip-copy-timer null }
  { syncing-chips ; object }
  { pref-open-seq 0 }
  { clock-open-seq 0 }
  { chip-open-seq 0 }
  { session-open-seq 0 }
  { packages-open-seq 0 }
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
  { minimap-el $minimap-el }
  { minimap-scale-handle $minimap-scale-handle }
  { minimap-header $minimap-header }
  { minimap-title-el $minimap-title-el }
  { minimap-zoom-out-btn $minimap-zoom-out-btn }
  { minimap-zoom-reset-btn $minimap-zoom-reset-btn }
  { minimap-zoom-in-btn $minimap-zoom-in-btn }
  { minimap-close-btn $minimap-close-btn }
  { minimap-stage $minimap-stage }
  { minimap-lanes-layer $minimap-lanes-layer }
  { minimap-viewport-el $minimap-viewport-el }
  { minimap-lane-els {} }
  { minimap-layout null }
  { is-minimap-dragging false }
  { is-minimap-scaling false }
  { active-minimap-drag-cleanup null }
  { active-minimap-scale-cleanup null }
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
  [ match
   { $rails.active-minimap-drag-cleanup : !rails.active-minimap-drag-cleanup }
  ]
  [ match
   { $rails.active-minimap-scale-cleanup : !rails.active-minimap-scale-cleanup false }
  ]
  [ match
   { $rails.sync-minimap : !rails.sync-minimap }
  ]
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

 ; to resolve-chip-key (
  ; to { item idx } $argv
  [ match
   { $item.id : ; add '' $item.id }
   { $item.url : ; add '' $item.url }
   { $item.label : ; add '' $item.label }
   { $item.row.id : ; add '' $item.row.id }
   { true : ; add 'idx:' $idx }
  ]
 )

 ; to rails.sync-chip-menu (
  -- Syncs the chip popover dropdown title, syncing busy button state, and Last synced timestamp with the currently active chip
  ; to item $rails.active-chip-item
  [ match
   { $item (
    ; to chip-key !resolve-chip-key $item $rails.active-chip-index
    ; to is-syncing [ propertyIs true rails.syncing-chips $chip-key ]
    ; set $is-syncing chip-sync-btn.disabled
    ; set [ ternary $is-syncing 'Syncing…' 'Sync now' ] chip-sync-btn.textContent
    ; set [ ternary $is-syncing 'top-rail-chip-menu-btn top-rail-chip-menu-btn--sync cc-btn-busy' 'top-rail-chip-menu-btn top-rail-chip-menu-btn--sync' ] chip-sync-btn.className
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
     { $is-syncing : 'Syncing…' }
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
  [ match
   { [ and { $rails.chip-copy-timer } { $window.clearTimeout } ] (
    !window.clearTimeout $rails.chip-copy-timer
    ; set null rails.chip-copy-timer
   ) }
  ]
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
   { [ and { $rails.chip-copy-timer } { $window.clearTimeout } ] (
    !window.clearTimeout $rails.chip-copy-timer
    ; set null rails.chip-copy-timer
   ) }
  ]
  [ match
   { $rails.active-chip-el (
    ; set top-rail-chip rails.active-chip-el.className
    [ match
     { $rails.active-chip-el.setAttribute : !rails.active-chip-el.setAttribute aria-expanded 'false' }
    ]
   ) }
  ]
  ; to cseq ; add $rails.chip-open-seq 1
  ; set $cseq rails.chip-open-seq
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
  ; condition { propertyIs $cseq rails.chip-open-seq } (
   !rails.sync-chip-menu
   ; set false chip-menu.hidden
  )
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
  ; to has-session [ match { $sid : true } { true : false } ]
  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; to dirty [ and { propertyIs false pending } { propertyIs true lane-control.session-dirty } ]
  ; to blocked [ match { $pending : true } { $dirty : true } { true : false } ]
  ; to sname [ match
   { $lane-control.session-meta.name : $lane-control.session-meta.name }
   { $sid : $sid }
   { $pending : 'Loading…' }
   { true : Session }
  ]
  ; to ver [ match
   { $lane-control.session-meta.version : ; add v $lane-control.session-meta.version }
   { $has-session : v1 }
   { $pending : '' }
   { true : v1 }
  ]
  ; to pending-lbl [ match
   { [ propertyIs '' lane-control.session-status-label ] : 'Loading…' }
   { $lane-control.session-status-label : $lane-control.session-status-label }
   { true : 'Loading…' }
  ]
  ; to status-txt [ match
   { [ and { [ propertyIs false has-session ] } { $pending } ] : $pending-lbl }
   { $pending : ; add $sname ; add ' · ' ; add $ver ; add ' (' ; add $pending-lbl ')' }
   { $dirty : ; add $sname ; add ' · ' ; add $ver '* (unsaved)' }
   { true : ; add $sname ; add ' · ' $ver }
  ]
  ; to status-ttl [ match
   { $sid : ; add $sname ; add ' (' ; add $sid ')' }
   { $pending : $pending-lbl }
   { true : Session }
  ]
  ; set $status-txt session-status-el.textContent
  ; set $status-ttl session-status-el.title
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
  ; to dir-ttl [ match
   { $dir-confirmed : ; add 'Permanent data directory: ' $dir-label }
   { true : 'Data directory not confirmed — click to select or confirm Default' }
  ]
  ; set $dir-label session-dir-el.textContent
  ; set $dir-ttl session-dir-el.title
  ; set [ ternary $dir-confirmed top-rail-menu-dir 'top-rail-menu-dir top-rail-menu-dir--unconfirmed' ] session-dir-el.className
  ; set [ match { [ and { [ propertyIs false has-session ] } { $pending } ] : true } { true : $dirs-disabled } ] session-dir-el.hidden
  ; set [ ternary $blocked false true ] session-draft-row.hidden
  ; set [ ternary $pending 'workspace-session-draft workspace-session-draft--pending' workspace-session-draft ] session-draft-row.className
  ; set [ ternary $pending $pending-lbl 'Unsaved version' ] session-draft-label.textContent
  ; set $pending session-draft-actions.hidden
  ; set $blocked session-new-btn.disabled
  !session-new-btn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
  ; set $pending session-fork-btn.disabled
  !session-fork-btn.setAttribute aria-disabled [ ternary $pending 'true' 'false' ]
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
      { $pending : [ match
       { $dirs-disabled : ; add $pending-lbl ; add ' — wait before switching to ' $rec.id }
       { true : ; add $pending-lbl ; add ' — wait before switching to ' ; add $rec.id ; add ' (' ; add $rec-dir ')' }
      ] }
      { $dirty : [ match
       { $dirs-disabled : ; add 'Resolve unsaved version (Save, Fork, or Abandon) before switching to ' $rec.id }
       { true : ; add 'Resolve unsaved version (Save, Fork, or Abandon) before switching to ' ; add $rec.id ; add ' (' ; add $rec-dir ')' }
      ] }
      { $dirs-disabled : ; add 'Switch to ' $rec.id }
      { true : ; add 'Switch to ' ; add $rec.id ; add ' (' ; add $rec-dir ')' }
     ]
     ; assign $rbtn { type button } { className 'top-rail-menu-item top-rail-menu-session-item' } { title $rbtn-title } { disabled $blocked }
     !rbtn.setAttribute aria-disabled [ ternary $blocked 'true' 'false' ]
     ; to rname !document.createElement span
     ; assign $rname { className top-rail-menu-session-name } { textContent $rec-name }
     ; to rdir !document.createElement span
     ; assign $rdir { className top-rail-menu-session-dir } { textContent $rec-dir }
     !rbtn.appendChild $rname
     ; condition { propertyIs false dirs-disabled } : !rbtn.appendChild $rdir
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
  -- Opens the Sessions dropdown menu anchored under the session button immediately and refreshes async session state
  !rails.close-packages-menu
  !rails.close-preferences-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  ; to sseq ; add $rails.session-open-seq 1
  ; set $sseq rails.session-open-seq
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
  [ match
   { $lane-control.ensure-session (
    ; try ( !lane-control.ensure-session ) : null
    [ match
     { [ and { [ propertyIs true rails.is-session-open ] } { [ propertyIs $sseq rails.session-open-seq ] } ] : !rails.sync-session-menu }
    ]
   ) }
  ]
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
  ; to sid [ match { $lane-control.session-id : $lane-control.session-id } { true : null } ]
  ; to has-session [ match { $sid : true } { true : false } ]
  ; to pending [ propertyIs true lane-control.session-status-pending ]
  ; set [ ternary [ and { [ propertyIs false has-session ] } { $pending } { [ propertyIs 0 pkgs.length ] } ] false true ] pkg-menu-loading-el.hidden
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
  -- Opens the Packages dropdown menu anchored under the packages button immediately and refreshes async session state
  !rails.close-session-menu
  !rails.close-preferences-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  ; to pkseq ; add $rails.packages-open-seq 1
  ; set $pkseq rails.packages-open-seq
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
  [ match
   { $lane-control.ensure-session (
    ; try ( !lane-control.ensure-session ) : null
    [ match
     { [ and { [ propertyIs true rails.is-packages-open ] } { [ propertyIs $pkseq rails.packages-open-seq ] } ] : !rails.sync-packages-menu }
    ]
   ) }
  ]
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
  ; to pref-loading [ and { $lane-control } { [ propertyIs true lane-control.preferences-loading ] } ]
  [ match
   { $pref-id (
    ; to pref-title [ match
     { $lane-control.get-lane-title : !lane-control.get-lane-title $pref-id }
     { true : $pref-id }
    ]
    ; to status-txt ; add 'Preferences: ' $pref-title
    ; to status-ttl ; add $pref-title ; add ' (' ; add $pref-id ')'
    ; set $status-txt pref-status-el.textContent
    ; set top-rail-menu-status pref-status-el.className
    ; set $status-ttl pref-status-el.title
    ; set false pref-open-btn.hidden
   ) }
   { $pref-loading (
    ; set 'Loading preferences…' pref-status-el.textContent
    ; set 'top-rail-menu-status cc-loading cc-loading--compact' pref-status-el.className
    ; set '' pref-status-el.title
    ; set true pref-open-btn.hidden
   ) }
   { true (
    ; set 'No preferences lane set' pref-status-el.textContent
    ; set top-rail-menu-status pref-status-el.className
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
  -- Opens the preferences dropdown menu anchored under the wrench button immediately and refreshes catalog async
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-chip-menu
  !rails.close-clock-menu
  ; to pseq ; add $rails.pref-open-seq 1
  ; set $pseq rails.pref-open-seq
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
  [ match
   { $lane-control.load-catalog (
    ; try ( !lane-control.load-catalog ) : null
    [ match
     { [ and { [ propertyIs true rails.is-preferences-open ] } { [ propertyIs $pseq rails.pref-open-seq ] } ] : !rails.sync-preferences-menu }
    ]
   ) }
  ]
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

    ; to dirs-disabled [ match
     { $lane-control.is-session-dirs-disabled : !lane-control.is-session-dirs-disabled }
     { [ propertyIs true lane-control.session-dirs-disabled ] : true }
     { true : false }
    ]
    ; each $list (
     ; to { item } $argv
     ; to display-name [ match { $item.name : $item.name } { true : $item.id } ]
     ; to dir-lbl [ match
      { $dirs-disabled : '' }
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
  -- Opens the searchable timezone selector popover immediately under clock-btn and refreshes preferences timezones async
  !rails.close-session-menu
  !rails.close-packages-menu
  !rails.close-preferences-menu
  !rails.close-chip-menu
  ; to cseq ; add $rails.clock-open-seq 1
  ; set $cseq rails.clock-open-seq
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
  [ match
   { $lane-control.sync-preferences-timezones (
    ; try ( !lane-control.sync-preferences-timezones ) : null
    [ match
     { [ and { [ propertyIs true rails.is-clock-open ] } { [ propertyIs $cseq rails.clock-open-seq ] } ] (
      !rails.sync-clock
      !rails.render-clock-options
     ) }
    ]
   ) }
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

 ; to finish-minimap-drag (
  -- Ends any active minimap viewport drag and cleans up window listeners
  ; to cleanup $rails.active-minimap-drag-cleanup
  [ match
   { $cleanup (
    ; set null rails.active-minimap-drag-cleanup
    !$cleanup
   ) }
  ]
 )

 ; to finish-minimap-scale (
  -- Ends any active minimap corner scale drag and cleans up window listeners
  ; to { save-flag } $argv
  ; to cleanup $rails.active-minimap-scale-cleanup
  [ match
   { $cleanup (
    ; set null rails.active-minimap-scale-cleanup
    !$cleanup $save-flag
   ) }
  ]
 )

 ; to measure-rect-box (
  -- Reads and normalizes bounding rect coordinates on an element or returns null
  ; to { el } $argv
  [ match
   { $el.getBoundingClientRect (
    ; to rect !el.getBoundingClientRect
    [ match
     { $rect (
      ; to l !resolve-num $rect.left
      ; to t !resolve-num $rect.top
      ; to w !resolve-num $rect.width
      ; to h !resolve-num $rect.height
      ; to r !resolve-num $rect.right
      ; to b !resolve-num $rect.bottom
      ; to has-l [ match { [ propertyIs null l ] : false } { true : true } ]
      ; to has-t [ match { [ propertyIs null t ] : false } { true : true } ]
      ; to has-w [ match { [ propertyIs null w ] : false } { true : true } ]
      ; to has-h [ match { [ propertyIs null h ] : false } { true : true } ]
      ; to has-r [ match { [ propertyIs null r ] : false } { true : true } ]
      ; to has-b [ match { [ propertyIs null b ] : false } { true : true } ]
      ; condition { and { propertyIs false has-r } { propertyIs true has-l } { propertyIs true has-w } } (
       ; set [ ; add $l $w ] r
       ; set true has-r
      )
      ; condition { and { propertyIs false has-w } { propertyIs true has-l } { propertyIs true has-r } } (
       ; set [ ; subtract $r $l ] w
       ; set true has-w
      )
      ; condition { and { propertyIs false has-b } { propertyIs true has-t } { propertyIs true has-h } } (
       ; set [ ; add $t $h ] b
       ; set true has-b
      )
      ; condition { and { propertyIs false has-h } { propertyIs true has-t } { propertyIs true has-b } } (
       ; set [ ; subtract $b $t ] h
       ; set true has-h
      )
      [ object { left $l } { top $t } { right $r } { bottom $b } { width $w } { height $h } { has-left $has-l } { has-top $has-t } { has-width $has-w } { has-height $has-h } { has-right $has-r } { has-bottom $has-b } ]
     ) }
     { true : null }
    ]
   ) }
   { true : null }
  ]
 )

 ; to apply-minimap-scroll (
  -- Scrolls the workspace window and document root immediately to the target scroll coordinates
  ; to { left top } $argv
  ; to clean-l !resolve-num $left
  ; to clean-t !resolve-num $top
  ; to target-l [ match
   { [ propertyIs null clean-l ] : 0 }
   { true : !window.Math.max 0 [ !window.Math.round $clean-l ] }
  ]
  ; to target-t [ match
   { [ propertyIs null clean-t ] : 0 }
   { true : !window.Math.max 0 [ !window.Math.round $clean-t ] }
  ]
  [ match
   { $window.scrollTo : !window.scrollTo $target-l $target-t }
  ]
  [ match
   { $document.documentElement (
    ; set $target-l document.documentElement.scrollLeft
    ; set $target-t document.documentElement.scrollTop
   ) }
  ]
 )

 ; to read-minimap-scroll (
  -- Reads current scroll offsets across window.scrollX/Y and documentElement.scrollLeft/Top
  ; to vx !resolve-num $window.scrollX
  ; to dx !resolve-num $document.documentElement.scrollLeft
  ; to vy !resolve-num $window.scrollY
  ; to dy !resolve-num $document.documentElement.scrollTop
  ; to sx [ match
   { [ propertyIsGreaterThan 0 vx ] : $vx }
   { [ propertyIsGreaterThan 0 dx ] : $dx }
   { true : 0 }
  ]
  ; to sy [ match
   { [ propertyIsGreaterThan 0 vy ] : $vy }
   { [ propertyIsGreaterThan 0 dy ] : $dy }
   { true : 0 }
  ]
  [ object { x $sx } { y $sy } ]
 )

 ; to measure-minimap-lanes (
  -- Collects workspace lane bounding boxes in document coordinates with left-to-right fallback for unmeasured mock DOMs
  ; to { scroll-x scroll-y } $argv
  ; to raw-lanes [ match
   { $lane-control.lanes : $lane-control.lanes }
   { true : {} }
  ]
  ; to entries {}
  ; to check ; object { all-valid true } { any-distinct false } { has-first false } { first-left 0 }
  ; each $raw-lanes (
   ; to { lane } $argv
   ; to is-min [ propertyIs true lane.is-minimized ]
   ; to min-w [ ternary $is-min 24 30 ]
   ; to h-box !measure-rect-box $lane.element
   ; to b-box !measure-rect-box $lane.body
   ; to h-ok [ match
    { [ and { $h-box } { propertyIs true h-box.has-left } { propertyIs true h-box.has-width } { propertyIsGreaterThanOrEqual $min-w h-box.width } ] : true }
    { true : false }
   ]
   ; to b-raw-ok [ match
    { [ and { $b-box } { propertyIs true b-box.has-left } { propertyIs true b-box.has-width } { propertyIsGreaterThanOrEqual $min-w b-box.width } ] : true }
    { true : false }
   ]
   ; to b-ok [ match
    { [ propertyIs false b-raw-ok ] : false }
    { [ propertyIs false h-ok ] : true }
    { true (
     ; to l-diff !window.Math.abs [ ; subtract $b-box.left $h-box.left ]
     [ propertyIsLessThanOrEqual 64 l-diff ]
    ) }
   ]
   ; to has-rect [ match
    { [ propertyIs true h-ok ] : true }
    { [ propertyIs true b-ok ] : true }
    { true : false }
   ]
   ; to raw-left [ match
    { [ and { propertyIs true h-ok } { propertyIs true b-ok } ] : !window.Math.min $h-box.left $b-box.left }
    { [ propertyIs true h-ok ] : $h-box.left }
    { [ propertyIs true b-ok ] : $b-box.left }
    { true : 0 }
   ]
   ; to raw-right [ match
    { [ and { propertyIs true h-ok } { propertyIs true b-ok } ] : !window.Math.max $h-box.right $b-box.right }
    { [ propertyIs true h-ok ] : $h-box.right }
    { [ propertyIs true b-ok ] : $b-box.right }
    { true : 320 }
   ]
   ; to raw-top [ match
    { [ and { propertyIs true h-ok } { propertyIs true h-box.has-top } { propertyIs true b-ok } { propertyIs true b-box.has-top } ] : !window.Math.min $h-box.top $b-box.top }
    { [ and { propertyIs true h-ok } { propertyIs true h-box.has-top } ] : $h-box.top }
    { [ and { propertyIs true b-ok } { propertyIs true b-box.has-top } ] : $b-box.top }
    { true : 36 }
   ]
   ; to raw-bottom [ match
    { [ and { propertyIs true h-ok } { propertyIs true h-box.has-bottom } { propertyIs true b-ok } { propertyIs true b-box.has-bottom } ] : !window.Math.max $h-box.bottom $b-box.bottom }
    { [ and { propertyIs true b-ok } { propertyIs true b-box.has-bottom } ] : $b-box.bottom }
    { [ and { propertyIs true h-ok } { propertyIs true h-box.has-bottom } ] : !window.Math.max $h-box.bottom [ ; add $raw-top 200 ] }
    { true : ; add $raw-top 200 }
   ]
   ; to raw-w !window.Math.max 1 [ ; subtract $raw-right $raw-left ]
   ; to raw-h !window.Math.max 24 [ ; subtract $raw-bottom $raw-top ]
   ; to same-left [ propertyIs $check.first-left raw-left ]
   [ match
    { [ propertyIs false has-rect ] : ; set false check.all-valid }
    { [ propertyIs false check.has-first ] (
     ; set true check.has-first
     ; set $raw-left check.first-left
    ) }
    { [ propertyIs false same-left ] : ; set true check.any-distinct }
   ]
   !entries.push [ object { lane $lane } { has-rect $has-rect } { left $raw-left } { top $raw-top } { width $raw-w } { height $raw-h } ]
  )
  ; to use-rects [ match
   { [ propertyIs 0 entries.length ] : true }
   { [ propertyIs false check.all-valid ] : false }
   { [ propertyIs 1 entries.length ] : true }
   { true : [ propertyIs true check.any-distinct ] }
  ]
  ; to out {}
  ; to cursor ; object { x 160 }
  ; each $entries (
   ; to { entry } $argv
   ; to lane $entry.lane
   ; to is-min [ propertyIs true lane.is-minimized ]
   ; to is-locked [ propertyIs true lane.is-locked ]
   ; to is-hl [ propertyIs true lane.is-highlighted ]
   [ match
    { [ propertyIs true use-rects ] (
     ; to doc-x !window.Math.max 0 [ ; add $scroll-x $entry.left ]
     ; to doc-y !window.Math.max 0 [ ; add $scroll-y $entry.top ]
     !out.push [ object { id $lane.id } { title $lane.title } { x $doc-x } { y $doc-y } { width $entry.width } { height $entry.height } { isMinimized $is-min } { isLocked $is-locked } { isHighlighted $is-hl } ]
    ) }
    { true (
     ; to col-w [ match
      { $is-min : 34 }
      { [ propertyIsGreaterThan 0 lane.effective-width ] : $lane.effective-width }
      { [ propertyIsGreaterThan 0 lane.rendered-width ] : $lane.rendered-width }
      { [ propertyIsGreaterThan 0 lane.width ] : $lane.width }
      { true : 380 }
     ]
     ; to col-h [ match
      { [ and { propertyIs true entry.has-rect } { propertyIsGreaterThan 40 entry.height } ] : $entry.height }
      { true : 480 }
     ]
     !out.push [ object { id $lane.id } { title $lane.title } { x $cursor.x } { y 36 } { width $col-w } { height $col-h } { isMinimized $is-min } { isLocked $is-locked } { isHighlighted $is-hl } ]
     ; set [ ; add [ ; add $cursor.x $col-w ] 4 ] cursor.x
    ) }
   ]
  )
  $out
 )

 ; to reconcile-minimap-lanes (
  -- Reconciles pooled minimap lane DOM elements against computed layout.lanes
  ; to { layout-lanes } $argv
  ; to items [ match { $layout-lanes : $layout-lanes } { true : {} } ]
  ; to pool $rails.minimap-lane-els
  ; while { propertyIsGreaterThan $items.length pool.length } (
   ; to extra !pool.pop
   [ match
    { $extra.el : !extra.el.remove }
   ]
  )
  ; each $items (
   ; to { item idx } $argv
   ; to existing [ match
    { [ propertyIsLessThan $pool.length idx ] : [ get pool $idx ] }
    { true : null }
   ]
   ; to rec [ match
    { $existing : $existing }
    { true (
     ; to box !document.createElement div
     ; set lane-minimap-lane box.className
     ; to lbl !document.createElement span
     ; set lane-minimap-lane-label lbl.className
     !box.appendChild $lbl
     !minimap-lanes-layer.appendChild $box
     ; to created [ object { el $box } { label-el $lbl } ]
     !pool.push $created
     $created
    ) }
   ]
   ; to box $rec.el
   ; to lbl $rec.label-el
   ; to base-cls lane-minimap-lane
   ; to c1 [ ternary [ propertyIs true item.isMinimized ] [ ; add $base-cls ' lane-minimap-lane--minimized' ] $base-cls ]
   ; to c2 [ ternary [ propertyIs true item.isLocked ] [ ; add $c1 ' lane-minimap-lane--locked' ] $c1 ]
   ; to c3 [ ternary [ propertyIs true item.isHighlighted ] [ ; add $c2 ' lane-minimap-lane--highlighted' ] $c2 ]
   ; set $c3 box.className
   !box.setAttribute data-lane-id $item.id
   ; to title-txt [ match
    { [ propertyIs true item.isMinimized ] : ; add $item.title ' (minimized)' }
    { true : $item.title }
   ]
   ; set $title-txt box.title
   [ match
    { $box.style (
     ; set [ ; add $item.left px ] box.style.left
     ; set [ ; add $item.top px ] box.style.top
     ; set [ ; add $item.width px ] box.style.width
     ; set [ ; add $item.height px ] box.style.height
    ) }
   ]
   ; to label-txt [ match
    { [ propertyIs true item.isMinimized ] : '' }
    { [ propertyIsGreaterThanOrEqual 28 item.width ] : $item.title }
    { [ propertyIsGreaterThanOrEqual 10 item.width ] : $item.initial }
    { true : '' }
   ]
   ; set $label-txt lbl.textContent
  )
 )

 ; to rails.sync-minimap (
  -- Synchronizes the bottom-right workspace minimap visibility, scale, lane rectangles, and viewport indicator
  ; to is-on [ propertyIs true lane-control.session-minimap ]
  ; to is-fs [ propertyIs true lane-control.is-lane-fullscreen ]
  ; to enabled [ ternary [ and { propertyIs true is-on } { propertyIs false is-fs } ] true false ]
  [ match
   { [ propertyIs false enabled ] (
    ; set true minimap-el.hidden
    null
   ) }
   { true (
    ; set false minimap-el.hidden
    ; set [ ternary [ propertyIs true rails.is-minimap-dragging ] 'lane-minimap lane-minimap--dragging' lane-minimap ] minimap-el.className
    ; to scroll-pos !read-minimap-scroll
    ; to doc-cw !resolve-num $document.documentElement.clientWidth
    ; to win-iw !resolve-num $window.innerWidth
    ; to vw [ match
     { [ propertyIsGreaterThan 0 doc-cw ] : $doc-cw }
     { [ propertyIsGreaterThan 0 win-iw ] : $win-iw }
     { true : 1280 }
    ]
    ; to doc-ch !resolve-num $document.documentElement.clientHeight
    ; to win-ih !resolve-num $window.innerHeight
    ; to vh [ match
     { [ propertyIsGreaterThan 0 doc-ch ] : $doc-ch }
     { [ propertyIsGreaterThan 0 win-ih ] : $win-ih }
     { true : 720 }
    ]
    ; to doc-sw [ match { [ propertyIsGreaterThan 0 document.documentElement.scrollWidth ] : $document.documentElement.scrollWidth } { true : 0 } ]
    ; to body-sw [ match { [ propertyIsGreaterThan 0 document.body.scrollWidth ] : $document.body.scrollWidth } { true : 0 } ]
    ; to sw !window.Math.max $doc-sw $body-sw
    ; to doc-sh [ match { [ propertyIsGreaterThan 0 document.documentElement.scrollHeight ] : $document.documentElement.scrollHeight } { true : 0 } ]
    ; to body-sh [ match { [ propertyIsGreaterThan 0 document.body.scrollHeight ] : $document.body.scrollHeight } { true : 0 } ]
    ; to sh !window.Math.max $doc-sh $body-sh
    ; to lane-rects !measure-minimap-lanes $scroll-pos.x $scroll-pos.y
    ; to layout-opts [ object
     { scale $lane-control.session-minimap-scale }
     { viewportWidth $vw }
     { viewportHeight $vh }
     { scrollX $scroll-pos.x }
     { scrollY $scroll-pos.y }
     { scrollWidth $sw }
     { scrollHeight $sh }
     { lanes $lane-rects }
    ]
    ; to layout [ match
     { $computeMinimapLayout : !computeMinimapLayout $layout-opts }
     { true (
      [ object
       { scale 1 }
       { scalePercent '100%' }
       { worldWidth $vw }
       { worldHeight $vh }
       { maxScrollX 0 }
       { maxScrollY 0 }
       { mapWidth 220 }
       { mapHeight 132 }
       { scaleX 1 }
       { scaleY 1 }
       { viewport [ object { left 0 } { top 0 } { width 220 } { height 132 } ] }
       { lanes {} }
      ]
     ) }
    ]
    ; set $layout rails.minimap-layout
    ; to n-lanes $layout.lanes.length
    ; to title-txt [ match
     { [ propertyIs 0 n-lanes ] : Minimap }
     { [ propertyIs 1 n-lanes ] : 'Minimap · 1 lane' }
     { true : ; add [ ; add 'Minimap · ' $n-lanes ] ' lanes' }
    ]
    ; set $title-txt minimap-title-el.textContent
    ; set $layout.scalePercent minimap-zoom-reset-btn.textContent
    ; to min-sc [ match { [ propertyIsGreaterThan 0 MIN_MINIMAP_SCALE ] : $MIN_MINIMAP_SCALE } { true : 0.5 } ]
    ; to max-sc [ match { [ propertyIsGreaterThan 0 MAX_MINIMAP_SCALE ] : $MAX_MINIMAP_SCALE } { true : 2.5 } ]
    ; set [ propertyIsLessThanOrEqual $min-sc layout.scale ] minimap-zoom-out-btn.disabled
    ; set [ propertyIsGreaterThanOrEqual $max-sc layout.scale ] minimap-zoom-in-btn.disabled
    ; set [ propertyIs 1 layout.scale ] minimap-zoom-reset-btn.disabled
    [ match
     { $minimap-stage.style (
      ; set [ ; add $layout.mapWidth px ] minimap-stage.style.width
      ; set [ ; add $layout.mapHeight px ] minimap-stage.style.height
     ) }
    ]
    !reconcile-minimap-lanes $layout.lanes
    [ match
     { $minimap-viewport-el.style (
      ; set [ ; add $layout.viewport.left px ] minimap-viewport-el.style.left
      ; set [ ; add $layout.viewport.top px ] minimap-viewport-el.style.top
      ; set [ ; add $layout.viewport.width px ] minimap-viewport-el.style.width
      ; set [ ; add $layout.viewport.height px ] minimap-viewport-el.style.height
     ) }
    ]
    $layout
   ) }
  ]
 )

 !minimap-zoom-out-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.step-session-minimap-scale : !lane-control.step-session-minimap-scale -1 }
  ]
 )
 !minimap-zoom-in-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.step-session-minimap-scale : !lane-control.step-session-minimap-scale 1 }
  ]
 )
 !minimap-zoom-reset-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.set-session-minimap-scale : !lane-control.set-session-minimap-scale 1 }
  ]
 )
 !minimap-close-btn.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.set-session-minimap : !lane-control.set-session-minimap false }
  ]
 )

 !minimap-scale-handle.addEventListener click (
  ; to { ev } $argv
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
 )
 !minimap-scale-handle.addEventListener dblclick (
  ; to { ev } $argv
  [ match
   { $ev.preventDefault : !ev.preventDefault }
  ]
  [ match
   { $ev.stopPropagation : !ev.stopPropagation }
  ]
  [ match
   { $lane-control.set-session-minimap-scale : !lane-control.set-session-minimap-scale 1 }
  ]
 )
 !minimap-scale-handle.addEventListener mousedown (
  ; to { ev } $argv
  ; to raw-btn $ev.button
  ; to ok-btn [ match
   { [ propertyIs undefined raw-btn ] : true }
   { [ propertyIs null raw-btn ] : true }
   { [ propertyIs 0 raw-btn ] : true }
   { true : false }
  ]
  ; condition { propertyIs true ok-btn } (
   [ match
    { $ev.preventDefault : !ev.preventDefault }
   ]
   [ match
    { $ev.stopPropagation : !ev.stopPropagation }
   ]
   !finish-minimap-scale false
   ; to rx !resolve-num $ev.clientX
   ; to ry !resolve-num $ev.clientY
   ; to start-x [ match { [ propertyIs null rx ] : 0 } { true : $rx } ]
   ; to start-y [ match { [ propertyIs null ry ] : 0 } { true : $ry } ]
   ; to cur-layout $rails.minimap-layout
   ; to start-scale [ match
    { $normalizeMinimapScale : !normalizeMinimapScale $lane-control.session-minimap-scale 1 }
    { [ propertyIsGreaterThan 0 lane-control.session-minimap-scale ] : $lane-control.session-minimap-scale }
    { true : 1 }
   ]
   ; to start-w [ match
    { [ propertyIsGreaterThan 0 cur-layout.mapWidth ] : $cur-layout.mapWidth }
    { true : 220 }
   ]
   ; to start-h [ match
    { [ propertyIsGreaterThan 0 cur-layout.mapHeight ] : $cur-layout.mapHeight }
    { true : 132 }
   ]
   ; to prev-cursor [ match
    { $document.body.style.cursor : $document.body.style.cursor }
    { true : '' }
   ]
   ; set true rails.is-minimap-scaling
   ; set 'lane-minimap-scale-handle lane-minimap-scale-handle--active' minimap-scale-handle.className
   [ match
    { $document.body.style : ; set nwse-resize document.body.style.cursor }
   ]
   ; to drag [ object { start-x $start-x } { start-y $start-y } { start-scale $start-scale } { start-w $start-w } { start-h $start-h } { next-scale $start-scale } { moved false } ]
   ; to on-move (
    ; to { mev } $argv
    ; to rmx !resolve-num $mev.clientX
    ; to rmy !resolve-num $mev.clientY
    ; to mx [ match { [ propertyIs null rmx ] : $drag.start-x } { true : $rmx } ]
    ; to my [ match { [ propertyIs null rmy ] : $drag.start-y } { true : $rmy } ]
    ; to dx ; subtract $mx $drag.start-x
    ; to dy ; subtract $my $drag.start-y
    ; to next-scale [ match
     { $computeMinimapDraggedScale : !computeMinimapDraggedScale $drag.start-scale $drag.start-w $drag.start-h $dx $dy }
     { true : $drag.start-scale }
    ]
    ; set true drag.moved
    ; set $next-scale drag.next-scale
    [ match
     { $lane-control.preview-minimap-scale : !lane-control.preview-minimap-scale $next-scale }
    ]
    [ match
     { [ and { propertyIs true lane-control.session-modal.is-open } { $lane-control.session-modal.render-session } ] : !lane-control.session-modal.render-session }
    ]
   )
   ; to teardown (
    ; to { save-flag } $argv
    ; set false rails.is-minimap-scaling
    ; set null rails.active-minimap-scale-cleanup
    ; set lane-minimap-scale-handle minimap-scale-handle.className
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
     { [ and { propertyIs true save-flag } { propertyIs true drag.moved } { $lane-control.set-session-minimap-scale } ] : !lane-control.set-session-minimap-scale $drag.next-scale }
    ]
   )
   ; to on-up : !finish-minimap-scale true
   ; to on-blur : !finish-minimap-scale true
   ; set $teardown rails.active-minimap-scale-cleanup
   [ match
    { $window.addEventListener (
     !window.addEventListener mousemove $on-move
     !window.addEventListener mouseup $on-up
     !window.addEventListener blur $on-blur
    ) }
   ]
  )
 )

 !minimap-stage.addEventListener mousedown (
  ; to { ev } $argv
  ; to raw-btn $ev.button
  ; to ok-btn [ match
   { [ propertyIs undefined raw-btn ] : true }
   { [ propertyIs null raw-btn ] : true }
   { [ propertyIs 0 raw-btn ] : true }
   { true : false }
  ]
  ; condition { and { propertyIs true ok-btn } { propertyIs true lane-control.session-minimap } } (
   [ match
    { $ev.preventDefault : !ev.preventDefault }
   ]
   [ match
    { $ev.stopPropagation : !ev.stopPropagation }
   ]
   !finish-minimap-drag
   !rails.sync-minimap
   ; to layout $rails.minimap-layout
   [ match
    { $layout (
    ; to rx !resolve-num $ev.clientX
    ; to ry !resolve-num $ev.clientY
    ; to start-x [ match { [ propertyIs null rx ] : 0 } { true : $rx } ]
    ; to start-y [ match { [ propertyIs null ry ] : 0 } { true : $ry } ]
    ; to sbox !measure-rect-box $minimap-stage
    ; to off-x !resolve-num $ev.offsetX
    ; to off-y !resolve-num $ev.offsetY
    ; to has-sbox [ match
     { [ and { $sbox } { propertyIs true sbox.has-left } { propertyIs true sbox.has-top } { propertyIs true sbox.has-width } { propertyIsGreaterThanOrEqual 24 sbox.width } ] : true }
     { true : false }
    ]
    ; to off-x-null [ propertyIs null off-x ]
    ; to off-y-null [ propertyIs null off-y ]
    ; to has-off [ match
     { [ and { propertyIs false off-x-null } { propertyIs false off-y-null } ] : true }
     { true : false }
    ]
    ; to map-x [ match
     { [ propertyIs true has-sbox ] : ; subtract $start-x $sbox.left }
     { [ propertyIs true has-off ] : $off-x }
     { true : null }
    ]
    ; to map-y [ match
     { [ propertyIs true has-sbox ] : ; subtract $start-y $sbox.top }
     { [ propertyIs true has-off ] : $off-y }
     { true : null }
    ]
    ; to map-x-null [ propertyIs null map-x ]
    ; to map-y-null [ propertyIs null map-y ]
    ; to has-map-pt [ match
     { [ and { propertyIs false map-x-null } { propertyIs false map-y-null } ] : true }
     { true : false }
    ]
    ; to vp $layout.viewport
    ; to vp-right ; add $vp.left $vp.width
    ; to vp-bottom ; add $vp.top $vp.height
    ; to hit-vp-el [ propertyIs $minimap-viewport-el ev.target ]
    ; to in-vp-box [ match
     { [ propertyIs false has-map-pt ] : false }
     { [ and { [ propertyIsGreaterThanOrEqual $vp.left map-x ] } { [ propertyIsLessThanOrEqual $vp-right map-x ] } { [ propertyIsGreaterThanOrEqual $vp.top map-y ] } { [ propertyIsLessThanOrEqual $vp-bottom map-y ] } ] : true }
     { true : false }
    ]
    ; to inside-vp [ match
     { [ propertyIs true hit-vp-el ] : true }
     { [ propertyIs true in-vp-box ] : true }
     { true : false }
    ]
    ; to anchor-box ; object { left $vp.left } { top $vp.top }
    [ match
     { [ and { propertyIs false inside-vp } { propertyIs true has-map-pt } ] (
      ; to max-vp-l !window.Math.max 0 [ ; subtract $layout.mapWidth $vp.width ]
      ; to max-vp-t !window.Math.max 0 [ ; subtract $layout.mapHeight $vp.height ]
      ; to raw-l ; subtract $map-x [ ; divide $vp.width 2 ]
      ; to raw-t ; subtract $map-y [ ; divide $vp.height 2 ]
      ; to next-l !window.Math.max 0 [ !window.Math.min $max-vp-l $raw-l ]
      ; to next-t !window.Math.max 0 [ !window.Math.min $max-vp-t $raw-t ]
      ; set $next-l anchor-box.left
      ; set $next-t anchor-box.top
      ; to jump-target [ match
       { $computeMinimapScrollTarget : !computeMinimapScrollTarget $layout $next-l $next-t }
       { true : ; object { left 0 } { top 0 } }
      ]
      !apply-minimap-scroll $jump-target.left $jump-target.top
      !rails.sync-minimap
     ) }
    ]
    ; to prev-cursor [ match
     { $document.body.style.cursor : $document.body.style.cursor }
     { true : '' }
    ]
    ; set true rails.is-minimap-dragging
    ; set 'lane-minimap lane-minimap--dragging' minimap-el.className
    [ match
     { $document.body.style : ; set grabbing document.body.style.cursor }
    ]
    ; to drag [ object { start-x $start-x } { start-y $start-y } { anchor-left $anchor-box.left } { anchor-top $anchor-box.top } { layout $layout } ]
    ; to on-move (
     ; to { mev } $argv
     ; to rmx !resolve-num $mev.clientX
     ; to rmy !resolve-num $mev.clientY
     ; to mx [ match { [ propertyIs null rmx ] : $drag.start-x } { true : $rmx } ]
     ; to my [ match { [ propertyIs null rmy ] : $drag.start-y } { true : $rmy } ]
     ; to desired-l ; add $drag.anchor-left [ ; subtract $mx $drag.start-x ]
     ; to desired-t ; add $drag.anchor-top [ ; subtract $my $drag.start-y ]
     ; to target [ match
      { $computeMinimapScrollTarget : !computeMinimapScrollTarget $drag.layout $desired-l $desired-t }
      { true : ; object { left 0 } { top 0 } }
     ]
     !apply-minimap-scroll $target.left $target.top
     !rails.sync-minimap
    )
    ; to teardown (
     ; set false rails.is-minimap-dragging
     ; set null rails.active-minimap-drag-cleanup
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
     !rails.sync-minimap
    )
    ; to on-up : !finish-minimap-drag
    ; to on-blur : !finish-minimap-drag
    ; set $teardown rails.active-minimap-drag-cleanup
    [ match
     { $window.addEventListener (
      !window.addEventListener mousemove $on-move
      !window.addEventListener mouseup $on-up
      !window.addEventListener blur $on-blur
     ) }
    ]
    ) }
   ]
  )
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
  ; to dirs-disabled [ match
   { $lane-control.is-session-dirs-disabled : !lane-control.is-session-dirs-disabled }
   { [ propertyIs true lane-control.session-dirs-disabled ] : true }
   { true : false }
  ]
  [ match
   { [ and { propertyIs false dirs-disabled } { propertyIs false lane-control.session-data-dir-confirmed } ] (
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
    ; to chip-key !resolve-chip-key $item $rails.active-chip-index
    [ match
     { [ propertyIs true rails.syncing-chips $chip-key ] : null }
     { true (
      ; to rails.syncing-chips $chip-key true
      !rails.sync-chip-menu
      ; try (
       [ match
        { $lane-control.sync-top-rail-chip : !lane-control.sync-top-rail-chip $item }
       ]
      ) : null
      ; to rails.syncing-chips $chip-key false
      !rails.sync-chip-menu
     ) }
    ]
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
    [ match
     { [ and { $rails.chip-copy-timer } { $window.clearTimeout } ] (
      !window.clearTimeout $rails.chip-copy-timer
      ; set null rails.chip-copy-timer
     ) }
    ]
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
    [ match
     { $window.setTimeout (
      ; to cseq $rails.chip-open-seq
      ; to t !window.setTimeout (
       [ match
        { [ and { [ propertyIs true rails.is-chip-menu-open ] } { [ propertyIs $cseq rails.chip-open-seq ] } ] : ; set Copy chip-copy-btn.textContent }
       ]
       ; set null rails.chip-copy-timer
      ) 1500
      ; set $t rails.chip-copy-timer
     ) }
    ]
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
    ; condition { propertyIs true lane-control.session-minimap } : !rails.sync-minimap
   )
   !window.addEventListener scroll (
    ; condition { and { propertyIs true lane-control.session-minimap } { propertyIs false rails.is-minimap-dragging } } : !rails.sync-minimap
   )
  ) }
 ]
 [ match
  { $window.ResizeObserver (
   ; try (
    ; to preview-ro !window.Reflect.construct $window.ResizeObserver { (
     ; condition { and { $rails.preview-lane } { propertyIs true rails.is-preview-pinned } } : !rails.sync-preview-resizer
     ; condition { propertyIs true lane-control.session-minimap } : !rails.sync-minimap
    ) }
    !preview-ro.observe $preview-el
    !preview-ro.observe $preview-frame
    [ match
     { $document.body : !preview-ro.observe $document.body }
    ]
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
 !rails.sync-minimap

 $rails
)
$scope
