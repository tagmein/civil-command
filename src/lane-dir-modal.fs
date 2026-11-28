-- file lane-dir-modal.fs
; to scope ; object
; to scope.create (
 -- Creates the real computer directory picker modal for selecting permanent per-session data directories or confirming Default
 ; to { lane-control } $argv

 ; to backdrop !document.createElement div
 ; set 'lane-modal-backdrop lane-dir-backdrop' backdrop.className
 !backdrop.setAttribute role dialog
 !backdrop.setAttribute aria-modal 'true'

 ; to panel !document.createElement div
 ; set 'lane-modal lane-dir-modal' panel.className

 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-config-title-wrap title-wrap.className
 ; to heading-el !document.createElement div
 ; assign $heading-el { className lane-modal-title } { textContent 'Select Data Directory' }
 ; to subtitle-el !document.createElement div
 ; assign $subtitle-el { className lane-config-id } { textContent '' }
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Cancel (Esc)' }
 !title-wrap.appendChild $heading-el
 !title-wrap.appendChild $subtitle-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn

 ; to notice-el !document.createElement div
 ; assign $notice-el { className lane-dir-notice } { textContent '' } { hidden true }

 ; to name-field !document.createElement div
 ; assign $name-field { className lane-config-field } { hidden true }
 ; to name-label !document.createElement label
 ; assign $name-label { className lane-config-label } { textContent 'Session Name (optional)' }
 ; to name-input !document.createElement input
 ; assign $name-input { type text } { className lane-config-input } { placeholder 'e.g. Research, Work, Local...' } { spellcheck false } { autocomplete off }
 !name-field.appendChild $name-label
 !name-field.appendChild $name-input

 ; to error-el !document.createElement div
 ; assign $error-el { className lane-session-error } { textContent '' } { hidden true }

 ; to warning-el !document.createElement div
 ; assign $warning-el { className lane-dir-warning } { textContent '' } { hidden true }

 ; to layout !document.createElement div
 ; set lane-dir-layout layout.className

 ; to sidebar !document.createElement div
 ; set lane-dir-sidebar sidebar.className
 ; to sidebar-hdr !document.createElement div
 ; assign $sidebar-hdr { className lane-config-label } { textContent 'Locations & Disks' }
 ; to roots-list !document.createElement div
 ; set lane-dir-roots roots-list.className
 !sidebar.appendChild $sidebar-hdr
 !sidebar.appendChild $roots-list

 ; to main !document.createElement div
 ; set lane-dir-main main.className

 ; to pathbar !document.createElement form
 ; set lane-dir-pathbar pathbar.className
 ; to up-btn !document.createElement button
 ; assign $up-btn { type button } { className lane-modal-action } { textContent '↑ Up' } { title 'Parent directory' }
 ; to path-input !document.createElement input
 ; assign $path-input { type text } { className 'lane-config-input lane-dir-path-input' } { placeholder '/path/to/directory' } { spellcheck false } { autocomplete off }
 ; to go-btn !document.createElement button
 ; assign $go-btn { type submit } { className lane-modal-action } { textContent Go }
 ; to refresh-btn !document.createElement button
 ; assign $refresh-btn { type button } { className lane-modal-action } { textContent '↻' } { title Refresh }
 !pathbar.appendChild $up-btn
 !pathbar.appendChild $path-input
 !pathbar.appendChild $go-btn
 !pathbar.appendChild $refresh-btn

 ; to crumbs-el !document.createElement div
 ; set lane-dir-breadcrumbs crumbs-el.className

 ; to toolbar !document.createElement div
 ; set lane-dir-toolbar toolbar.className
 ; to filter-input !document.createElement input
 ; assign $filter-input { type text } { className 'lane-config-input lane-dir-filter' } { placeholder 'Filter folders (start with . for hidden)...' } { spellcheck false } { autocomplete off }
 ; to hidden-btn !document.createElement button
 ; assign $hidden-btn { type button } { className 'lane-modal-action lane-dir-hidden-btn' } { textContent 'Show hidden' }
 ; to new-folder-btn !document.createElement button
 ; assign $new-folder-btn { type button } { className 'lane-modal-action lane-dir-new-btn' } { textContent '+ New Folder' }
 !toolbar.appendChild $filter-input
 !toolbar.appendChild $hidden-btn
 !toolbar.appendChild $new-folder-btn

 ; to new-folder-row !document.createElement form
 ; assign $new-folder-row { className lane-dir-newfolder } { hidden true }
 ; to new-folder-input !document.createElement input
 ; assign $new-folder-input { type text } { className lane-config-input } { placeholder 'New folder name...' } { spellcheck false } { autocomplete off }
 ; to new-folder-submit !document.createElement button
 ; assign $new-folder-submit { type submit } { className 'lane-modal-action lane-modal-action--open' } { textContent Create }
 ; to new-folder-cancel !document.createElement button
 ; assign $new-folder-cancel { type button } { className lane-modal-action } { textContent Cancel }
 !new-folder-row.appendChild $new-folder-input
 !new-folder-row.appendChild $new-folder-submit
 !new-folder-row.appendChild $new-folder-cancel

 ; to dir-list !document.createElement div
 ; set lane-dir-list dir-list.className

 !main.appendChild $pathbar
 !main.appendChild $crumbs-el
 !main.appendChild $toolbar
 !main.appendChild $new-folder-row
 !main.appendChild $dir-list

 !layout.appendChild $sidebar
 !layout.appendChild $main

 ; to footer !document.createElement div
 ; set lane-dir-footer footer.className
 ; to selected-el !document.createElement div
 ; assign $selected-el { className lane-dir-selected } { textContent 'Selected: none' }
 ; to footer-acts !document.createElement div
 ; set lane-dir-footer-actions footer-acts.className
 ; to cancel-btn !document.createElement button
 ; assign $cancel-btn { type button } { className 'lane-modal-action lane-config-btn--cancel' } { textContent Cancel }
 ; to default-btn !document.createElement button
 ; assign $default-btn { type button } { className lane-modal-action } { textContent 'Use Default' }
 ; to select-btn !document.createElement button
 ; assign $select-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent 'Create Here' }
 !footer-acts.appendChild $cancel-btn
 !footer-acts.appendChild $default-btn
 !footer-acts.appendChild $select-btn
 !footer.appendChild $selected-el
 !footer.appendChild $footer-acts

 !panel.appendChild $header
 !panel.appendChild $notice-el
 !panel.appendChild $name-field
 !panel.appendChild $error-el
 !panel.appendChild $warning-el
 !panel.appendChild $layout
 !panel.appendChild $footer
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { heading-el $heading-el }
  { subtitle-el $subtitle-el }
  { close-btn $close-btn }
  { notice-el $notice-el }
  { name-field $name-field }
  { name-input $name-input }
  { error-el $error-el }
  { warning-el $warning-el }
  { roots-list $roots-list }
  { pathbar $pathbar }
  { up-btn $up-btn }
  { path-input $path-input }
  { go-btn $go-btn }
  { refresh-btn $refresh-btn }
  { crumbs-el $crumbs-el }
  { filter-input $filter-input }
  { hidden-btn $hidden-btn }
  { new-folder-btn $new-folder-btn }
  { new-folder-row $new-folder-row }
  { new-folder-input $new-folder-input }
  { new-folder-submit $new-folder-submit }
  { new-folder-cancel $new-folder-cancel }
  { dir-list $dir-list }
  { selected-el $selected-el }
  { cancel-btn $cancel-btn }
  { default-btn $default-btn }
  { select-btn $select-btn }
  { is-open false }
  { mode confirm }
  { tab-only false }
  { previous-session-id null }
  { previous-was-tab false }
  { home-path '' }
  { current-path '' }
  { parent-path null }
  { writable true }
  { show-hidden false }
  { filter-query '' }
  { roots {} }
  { root-els {} }
  { root-items {} }
  { breadcrumbs {} }
  { crumb-els {} }
  { directories {} }
  { dir-els {} }
  { dir-items {} }
  { roots-loading false }
  { dirs-loading false }
  { roots-seq 0 }
  { nav-seq 0 }
  { creating-folder false }
  { submitting false }
  { on-complete null }
 ]

 ; to clear-els (
  ; to { list } $argv
  ; while { propertyIsGreaterThan 0 list.length } (
   ; to old !list.pop
   !old.remove
  )
 )

 ; to can-dismiss (
  [ match
   { [ propertyIs create modal.mode ] : true }
   { $modal.previous-session-id : true }
   { true : false }
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

 ; to set-warning (
  ; to { msg } $argv
  ; to clean [ match
   { [ propertyIs null msg ] : '' }
   { [ propertyIs undefined msg ] : '' }
   { true : ; add '' $msg }
  ]
  ; set $clean warning-el.textContent
  ; set [ ternary [ propertyIs '' clean ] true false ] warning-el.hidden
 )

 ; to sync-controls (
  ; to dismissible !can-dismiss
  ; set [ ternary $dismissible false true ] close-btn.hidden
  ; set [ ternary $dismissible false true ] cancel-btn.hidden

  ; to has-parent [ match
   { $modal.parent-path : true }
   { true : false }
  ]
  ; set [ ternary $has-parent false true ] up-btn.disabled

  ; to has-cur [ match
   { [ propertyIs '' modal.current-path ] : false }
   { [ propertyIs null modal.current-path ] : false }
   { [ propertyIs undefined modal.current-path ] : false }
   { true : true }
  ]
  ; to can-write [ match
   { [ propertyIs false has-cur ] : false }
   { [ propertyIs false modal.writable ] : false }
   { true : true }
  ]
  ; set [ ternary $can-write false true ] new-folder-btn.disabled
  ; set [ ternary $can-write false true ] select-btn.disabled

  ; set [ ternary $modal.show-hidden 'lane-modal-action lane-dir-hidden-btn lane-dir-hidden-btn--active' 'lane-modal-action lane-dir-hidden-btn' ] hidden-btn.className
  ; set [ ternary $modal.show-hidden 'Hide hidden' 'Show hidden' ] hidden-btn.textContent

  ; to sel-txt [ match
   { [ propertyIs false has-cur ] : 'Selected: Choose a folder or Default' }
   { [ propertyIs false modal.writable ] : ; add 'Selected: ' ; add $modal.current-path ' (read-only)' }
   { true : ; add 'Selected: ' $modal.current-path }
  ]
  ; set $sel-txt selected-el.textContent
  ; set [ match { $has-cur : $modal.current-path } { true : '' } ] selected-el.title
 )

 ; to render-roots (
  !clear-els $modal.root-els
  ; set 0 modal.root-items.length
  [ match
   { [ and { [ propertyIs true modal.roots-loading ] } { [ propertyIs 0 modal.roots.length ] } ] (
    ; to load-r !document.createElement div
    ; assign $load-r { className 'cc-loading cc-loading--compact' } { textContent 'Loading locations…' }
    !roots-list.appendChild $load-r
    !modal.root-els.push $load-r
   ) }
   { [ propertyIs 0 modal.roots.length ] (
    ; to empty-r !document.createElement div
    ; assign $empty-r { className lane-dir-empty } { textContent 'No locations found' }
    !roots-list.appendChild $empty-r
    !modal.root-els.push $empty-r
   ) }
   { true (
    ; each $modal.roots (
     ; to { r } $argv
     ; to is-act [ propertyIs $modal.current-path r.path ]
     ; to btn !document.createElement button
     ; assign $btn { type button } { className [ ternary $is-act 'lane-dir-disk-btn lane-dir-disk-btn--active' lane-dir-disk-btn ] } { title $r.path }
     ; to nm !document.createElement span
     ; assign $nm { className lane-dir-disk-name } { textContent $r.name }
     !btn.appendChild $nm
     ; to tag-txt [ match
      { $r.fsType : $r.fsType }
      { [ propertyIs disk r.kind ] : disk }
      { true : '' }
     ]
     [ match
      { $tag-txt (
       ; to tag !document.createElement span
       ; assign $tag { className lane-dir-tag } { textContent $tag-txt }
       !btn.appendChild $tag
      ) }
     ]
     !btn.addEventListener click : !modal.navigate $r.path
     !roots-list.appendChild $btn
     !modal.root-els.push $btn
     !modal.root-items.push ; object { root $r } { el $btn }
    )
   ) }
  ]
 )

 ; to render-breadcrumbs (
  !clear-els $modal.crumb-els
  ; each $modal.breadcrumbs (
   ; to { c idx } $argv
   [ match
    { [ propertyIsGreaterThan 0 idx ] (
     ; to prev-idx [ subtract $idx 1 ]
     ; to prev [ get modal.breadcrumbs $prev-idx ]
     ; to prev-is-slash [ propertyIs '/' prev.name ]
     ; condition { propertyIs false prev-is-slash } (
      ; to sep !document.createElement span
      ; assign $sep { className lane-dir-crumb-sep } { textContent '/' }
      !crumbs-el.appendChild $sep
      !modal.crumb-els.push $sep
     )
    ) }
   ]
   ; to cbtn !document.createElement button
   ; assign $cbtn { type button } { className lane-dir-crumb } { textContent $c.name } { title $c.path }
   !cbtn.addEventListener click : !modal.navigate $c.path
   !crumbs-el.appendChild $cbtn
   !modal.crumb-els.push $cbtn
  )
 )

 ; to render-directories (
  !clear-els $modal.dir-els
  ; set 0 modal.dir-items.length
  [ match
   { [ propertyIs true modal.dirs-loading ] (
    ; to load-d !document.createElement div
    ; assign $load-d { className 'cc-loading cc-loading--dir' } { textContent 'Loading folders…' }
    !dir-list.appendChild $load-d
    !modal.dir-els.push $load-d
   ) }
   { true (
    ; to raw-q !modal.filter-query.trim
    ; to q !raw-q.toLowerCase
    ; to q-dot [ match
     { $q.startsWith : !q.startsWith '.' }
     { true : false }
    ]
    ; to reveal-hidden [ match
     { $modal.show-hidden : true }
     { $q-dot : true }
     { true : false }
    ]
    [ match
     { $modal.parent-path (
      [ match
       { [ propertyIs '' q ] (
        ; to pbtn !document.createElement button
        ; assign $pbtn { type button } { className 'lane-dir-row lane-dir-row--parent' } { title $modal.parent-path }
        ; to pico !document.createElement span
        ; assign $pico { className lane-dir-row-icon } { textContent '↩' }
        ; to pname !document.createElement span
        ; assign $pname { className lane-dir-row-name } { textContent '..' }
        !pbtn.appendChild $pico
        !pbtn.appendChild $pname
        !pbtn.addEventListener click : !modal.navigate $modal.parent-path
        !dir-list.appendChild $pbtn
        !modal.dir-els.push $pbtn
       ) }
      ]
     ) }
    ]
    ; to stats ; object { shown 0 } { omitted-hidden 0 }
    ; each $modal.directories (
     ; to { dir } $argv
     ; to skip-hidden [ match
      { [ propertyIs true dir.hidden ] : [ ternary $reveal-hidden false true ] }
      { true : false }
     ]
     [ match
      { $skip-hidden : ; set [ ; add $stats.omitted-hidden 1 ] stats.omitted-hidden }
      { true (
       ; to low !dir.name.toLowerCase
       ; to hit [ match
        { [ propertyIs '' q ] : true }
        { [ !low.includes $q ] : true }
        { true : false }
       ]
       [ match
        { $hit (
         ; set [ ; add $stats.shown 1 ] stats.shown
         ; to row !document.createElement button
         ; assign $row { type button } { className lane-dir-row } { title $dir.path }
         ; to ico !document.createElement span
         ; assign $ico { className lane-dir-row-icon } { textContent '▸' }
         ; to nm !document.createElement span
         ; assign $nm { className lane-dir-row-name } { textContent $dir.name }
         !row.appendChild $ico
         !row.appendChild $nm
         [ match
          { $dir.hidden (
           ; to htag !document.createElement span
           ; assign $htag { className lane-dir-tag } { textContent hidden }
           !row.appendChild $htag
          ) }
         ]
         [ match
          { $dir.symlink (
           ; to stag !document.createElement span
           ; assign $stag { className lane-dir-tag } { textContent link }
           !row.appendChild $stag
          ) }
         ]
         !row.addEventListener click : !modal.navigate $dir.path
         !dir-list.appendChild $row
         !modal.dir-els.push $row
         !modal.dir-items.push ; object { dir $dir } { el $row }
        ) }
       ]
      ) }
     ]
    )
    [ match
     { [ propertyIs 0 stats.shown ] (
      ; to msg [ match
       { [ propertyIsGreaterThan 0 q.length ] : 'No matching folders' }
       { [ propertyIsGreaterThan 0 stats.omitted-hidden ] : ; add 'No visible subfolders (' ; add $stats.omitted-hidden ' hidden — click "Show hidden")' }
       { true : 'No subfolders in this directory' }
      ]
      ; to empty-d !document.createElement div
      ; assign $empty-d { className lane-dir-empty } { textContent $msg }
      !dir-list.appendChild $empty-d
      !modal.dir-els.push $empty-d
     ) }
    ]
   ) }
  ]
 )

 ; to modal.load-roots (
  -- Fetches attached disks and base locations from the server FS API
  ; to rseq ; add $modal.roots-seq 1
  ; set $rseq modal.roots-seq
  ; set true modal.roots-loading
  ; condition { propertyIs 0 modal.roots.length } : !render-roots
  [ match
   { $fetchFsRoots (
    ; try (
     ; to res !fetchFsRoots
     ; condition { propertyIs $rseq modal.roots-seq } (
      ; set false modal.roots-loading
      ; to roots [ match
       { $res.roots : $res.roots }
       { true : {} }
      ]
      ; set $roots modal.roots
      [ match
       { $res.home : ; set $res.home modal.home-path }
      ]
      !render-roots
     )
     $res
    ) (
     ; to { err } $argv
     ; to msg [ match { $err.message : $err.message } { true : 'Failed to load computer locations' } ]
     ; condition { propertyIs $rseq modal.roots-seq } (
      ; set false modal.roots-loading
      !set-error $msg
      !render-roots
     )
     null
    )
   ) }
   { true (
    ; condition { propertyIs $rseq modal.roots-seq } (
     ; set false modal.roots-loading
     !render-roots
    )
    null
   ) }
  ]
 )

 ; to modal.navigate (
  -- Navigates the directory browser to target-path and lists its subfolders
  ; to { target-path } $argv
  ; to nseq ; add $modal.nav-seq 1
  ; set $nseq modal.nav-seq
  ; set true modal.dirs-loading
  ; set true new-folder-row.hidden
  ; set '' new-folder-input.value
  !render-directories
  [ match
   { $fetchFsList (
    ; try (
     ; to req-path [ match
      { $target-path : ; add '' $target-path }
      { true : '' }
     ]
     ; to res !fetchFsList $req-path
     ; condition { propertyIs $nseq modal.nav-seq } (
      ; set false modal.dirs-loading
      [ match
       { $res.path (
        ; set $res.path modal.current-path
        ; set $res.path path-input.value
       ) }
      ]
      ; set [ match { $res.parent : $res.parent } { true : null } ] modal.parent-path
      ; set [ match { $res.breadcrumbs : $res.breadcrumbs } { true : {} } ] modal.breadcrumbs
      ; set [ ternary [ propertyIs false res.writable ] false true ] modal.writable
      [ match
       { [ propertyIs false res.ok ] (
        !set-error [ match { $res.error : $res.error } { true : 'Unable to open directory' } ]
        !set-warning ''
        ; set {} modal.directories
       ) }
       { true (
        !set-error ''
        [ match
         { $res.writable : !set-warning '' }
         { true : !set-warning 'This folder is read-only. Choose a writable folder or create a subfolder elsewhere.' }
        ]
        ; set [ match { $res.directories : $res.directories } { true : {} } ] modal.directories
        ; set '' modal.filter-query
        ; set '' filter-input.value
       ) }
      ]
      !render-roots
      !render-breadcrumbs
      !render-directories
      !sync-controls
     )
     $res
    ) (
     ; to { err } $argv
     ; to msg [ match { $err.message : $err.message } { true : 'Failed to list directory' } ]
     ; condition { propertyIs $nseq modal.nav-seq } (
      ; set false modal.dirs-loading
      !set-error $msg
      !render-directories
      !sync-controls
     )
     null
    )
   ) }
   { true (
    ; condition { propertyIs $nseq modal.nav-seq } (
     ; set false modal.dirs-loading
     !render-breadcrumbs
     !render-directories
     !sync-controls
    )
    null
   ) }
  ]
 )

 ; to modal.create-folder (
  -- Creates a new subfolder inside the currently open directory and navigates into it
  ; to { raw-name } $argv
  [ match
   { [ propertyIs true modal.creating-folder ] : null }
   { true (
    ; to clean [ match
     { $raw-name : !raw-name.trim }
     { true : '' }
    ]
    [ match
     { [ propertyIs '' clean ] (
      !set-error 'Enter a folder name'
      null
     ) }
     { [ propertyIs '' modal.current-path ] (
      !set-error 'Navigate to a parent folder first'
      null
     ) }
     { $createFsDir (
      ; set true modal.creating-folder
      ; set true new-folder-submit.disabled
      ; set 'lane-modal-action lane-modal-action--open cc-btn-busy' new-folder-submit.className
      ; set 'Creating…' new-folder-submit.textContent
      ; to create-res null
      ; try (
       ; to res !createFsDir $modal.current-path $clean
       ; set $res create-res
       [ match
        { [ propertyIs false res.ok ] (
         !set-error [ match { $res.error : $res.error } { true : 'Could not create folder' } ]
        ) }
        { true (
         !set-error ''
         ; set true new-folder-row.hidden
         ; set '' new-folder-input.value
         !modal.navigate $res.path
        ) }
       ]
      ) (
       ; to { err } $argv
       !set-error [ match { $err.message : $err.message } { true : 'Could not create folder' } ]
       null
      )
      ; set false modal.creating-folder
      ; set false new-folder-submit.disabled
      ; set 'lane-modal-action lane-modal-action--open' new-folder-submit.className
      ; set Create new-folder-submit.textContent
      $create-res
     ) }
     { true null }
    ]
   ) }
  ]
 )

 ; to modal.close (
  -- Closes the directory picker modal and detaches it from the DOM
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   ; set false modal.roots-loading
   ; set false modal.dirs-loading
   ; set [ ; add $modal.roots-seq 1 ] modal.roots-seq
   ; set [ ; add $modal.nav-seq 1 ] modal.nav-seq
   ; set null modal.on-complete
   ; set true new-folder-row.hidden
   !set-error ''
   !set-warning ''
   !backdrop.remove
  )
 )

 ; to modal.cancel (
  -- Cancels directory selection when dismissible (restoring previous confirmed session if switching)
  ; to dismissible !can-dismiss
  [ match
   { [ propertyIs false dismissible ] : null }
   { [ propertyIs confirm modal.mode ] (
    [ match
     { $modal.previous-session-id (
      ; to prev-id $modal.previous-session-id
      ; to prev-tab $modal.previous-was-tab
      ; set null modal.previous-session-id
      ; set false modal.previous-was-tab
      !modal.close
      [ match
       { $prev-tab : !lane-control.switch-tab-session $prev-id }
       { true : !lane-control.switch-session $prev-id }
      ]
     ) }
     { true : !modal.close }
    ]
   ) }
   { true : !modal.close }
  ]
 )

 ; to modal.use-selected (
  -- Confirms or creates the session permanently using modal.current-path
  [ match
   { [ propertyIs true modal.submitting ] : null }
   { true (
    ; to has-cur [ match
     { [ propertyIs '' modal.current-path ] : false }
     { [ propertyIs null modal.current-path ] : false }
     { [ propertyIs undefined modal.current-path ] : false }
     { true : true }
    ]
    [ match
     { [ propertyIs false has-cur ] (
      !set-error 'Navigate to a directory first or choose Default'
      null
     ) }
     { [ propertyIs false modal.writable ] (
      !set-error 'This directory is read-only. Choose a writable folder or choose Default.'
      null
     ) }
     { true (
      ; set true modal.submitting
      ; to prev-lbl $select-btn.textContent
      ; set true select-btn.disabled
      ; set true default-btn.disabled
      ; set 'lane-modal-action lane-modal-action--open cc-btn-busy' select-btn.className
      ; set [ ternary [ propertyIs create modal.mode ] 'Creating…' 'Saving…' ] select-btn.textContent
      ; to out-res null
      ; try (
       ; to chosen $modal.current-path
       ; to cur-mode $modal.mode
       ; to is-tab $modal.tab-only
       ; to sess-name !name-input.value.trim
       ; to cb $modal.on-complete
       [ match
        { [ propertyIs create cur-mode ] (
         !modal.close
         ; to res [ match
          { $is-tab : !lane-control.new-tab-session $sess-name $chosen true }
          { true : !lane-control.new-session $sess-name $chosen true }
         ]
         ; set $res out-res
         [ match
          { $cb : !$cb $res }
         ]
        ) }
        { true (
         ; to res !lane-control.confirm-session-data-dir $chosen
         ; set $res out-res
         [ match
          { [ propertyIs false res.ok ] (
           !set-error [ match { $res.error : $res.error } { true : 'Could not set directory' } ]
          ) }
          { true (
           !modal.close
           [ match
            { $cb : !$cb $res }
           ]
          ) }
         ]
        ) }
       ]
      ) (
       ; to { err } $argv
       !set-error [ match { $err.message : $err.message } { true : 'Operation failed' } ]
       null
      )
      ; set false modal.submitting
      ; set 'lane-modal-action lane-modal-action--open' select-btn.className
      ; set $prev-lbl select-btn.textContent
      ; set false default-btn.disabled
      !sync-controls
      $out-res
     ) }
    ]
   ) }
  ]
 )

 ; to modal.use-default (
  -- Explicitly selects or confirms Default storage for the session
  [ match
   { [ propertyIs true modal.submitting ] : null }
   { true (
    ; set true modal.submitting
    ; to prev-def-lbl $default-btn.textContent
    ; set true default-btn.disabled
    ; set true select-btn.disabled
    ; set 'lane-modal-action cc-btn-busy' default-btn.className
    ; set 'Saving…' default-btn.textContent
    ; to out-res null
    ; try (
     ; to cur-mode $modal.mode
     ; to is-tab $modal.tab-only
     ; to sess-name !name-input.value.trim
     ; to cb $modal.on-complete
     [ match
      { [ propertyIs create cur-mode ] (
       !modal.close
       ; to res [ match
        { $is-tab : !lane-control.new-tab-session $sess-name null true }
        { true : !lane-control.new-session $sess-name null true }
       ]
       ; set $res out-res
       [ match
        { $cb : !$cb $res }
       ]
      ) }
      { true (
       ; to res !lane-control.confirm-session-data-dir null
       ; set $res out-res
       [ match
        { [ propertyIs false res.ok ] (
         !set-error [ match { $res.error : $res.error } { true : 'Could not confirm Default directory' } ]
        ) }
        { true (
         !modal.close
         [ match
          { $cb : !$cb $res }
         ]
        ) }
       ]
      ) }
     ]
    ) (
     ; to { err } $argv
     !set-error [ match { $err.message : $err.message } { true : 'Operation failed' } ]
     null
    )
    ; set false modal.submitting
    ; set lane-modal-action default-btn.className
    ; set $prev-def-lbl default-btn.textContent
    ; set false default-btn.disabled
    !sync-controls
    $out-res
   ) }
  ]
 )

 ; to open-shared (
  ; to { initial-path } $argv
  !set-error ''
  !set-warning ''
  ; set true new-folder-row.hidden
  ; set '' new-folder-input.value
  ; set '' modal.filter-query
  ; set '' filter-input.value
  ; set '' modal.current-path
  ; set '' path-input.value
  ; set null modal.parent-path
  ; set true modal.writable
  ; set {} modal.breadcrumbs
  ; set {} modal.directories
  ; set true modal.roots-loading
  ; set true modal.dirs-loading
  !sync-controls
  !render-roots
  !render-directories
  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   [ match
    { $document.body.appendChild : !document.body.appendChild $backdrop }
   ]
  )
  ; to roots-res !modal.load-roots
  ; to start-path [ match
   { $initial-path : $initial-path }
   { $roots-res.home : $roots-res.home }
   { $modal.home-path : $modal.home-path }
   { true : '~' }
  ]
  !modal.navigate $start-path
  $modal
 )

 ; to modal.open-create (
  -- Opens the computer directory picker in Create Session mode
  ; to { opts } $argv
  ; to dirs-disabled [ match
   { $lane-control.is-session-dirs-disabled : !lane-control.is-session-dirs-disabled }
   { [ propertyIs true lane-control.session-dirs-disabled ] : true }
   { true : false }
  ]
  [ match
   { $dirs-disabled (
    ; to is-tab [ ternary $opts.tab-only true false ]
    ; to sess-name [ match
     { $opts.name.trim : !opts.name.trim }
     { $opts.name : ; add '' $opts.name }
     { true : '' }
    ]
    ; to cb $opts.on-complete
    ; to res [ match
     { $is-tab : !lane-control.new-tab-session $sess-name null true }
     { true : !lane-control.new-session $sess-name null true }
    ]
    [ match
     { $cb : !$cb $res }
    ]
    $res
   ) }
   { true (
    ; set create modal.mode
    ; set [ ternary $opts.tab-only true false ] modal.tab-only
    ; set null modal.previous-session-id
    ; set false modal.previous-was-tab
    ; set [ match { $opts.on-complete : $opts.on-complete } { true : null } ] modal.on-complete
    ; to ttl [ match
     { $modal.tab-only : 'New Tab Session — Choose Data Directory' }
     { true : 'New Session — Choose Data Directory' }
    ]
    ; set $ttl heading-el.textContent
    ; set 'Pick a permanent folder on your computer or attached disk where session data will be written, or choose Default.' subtitle-el.textContent
    ; set true notice-el.hidden
    ; set false name-field.hidden
    ; set [ match { $opts.name : $opts.name } { true : '' } ] name-input.value
    ; set 'Use Default' default-btn.textContent
    ; set 'Create Here' select-btn.textContent
    !open-shared $opts.initial-path
   ) }
  ]
 )

 ; to modal.open-confirm (
  -- Opens the computer directory picker in Confirm mode for an unconfirmed session
  ; to { opts } $argv
  ; to dirs-disabled [ match
   { $lane-control.is-session-dirs-disabled : !lane-control.is-session-dirs-disabled }
   { [ propertyIs true lane-control.session-dirs-disabled ] : true }
   { true : false }
  ]
  [ match
   { $dirs-disabled : null }
   { true (
    ; set confirm modal.mode
    ; set false modal.tab-only
    ; set [ match { $opts.previous-session-id : $opts.previous-session-id } { true : null } ] modal.previous-session-id
    ; set [ ternary $opts.previous-was-tab true false ] modal.previous-was-tab
    ; set [ match { $opts.on-complete : $opts.on-complete } { true : null } ] modal.on-complete
    ; to sess-name [ match
     { $lane-control.session-meta.name : $lane-control.session-meta.name }
     { $lane-control.session-id : $lane-control.session-id }
     { true : Session }
    ]
    ; set 'Select Data Directory' heading-el.textContent
    ; set 'Permanent storage directory selection is required for every session.' subtitle-el.textContent
    ; set [ ; add 'Session "' ; add $sess-name '" does not have a permanent data directory selected yet. Confirm Default or pick a folder on your computer or attached disk.' ] notice-el.textContent
    ; set false notice-el.hidden
    ; set true name-field.hidden
    ; set 'Confirm Default' default-btn.textContent
    ; set 'Use This Directory' select-btn.textContent
    !open-shared $opts.initial-path
   ) }
  ]
 )

 !pathbar.addEventListener submit (
  ; to { ev } $argv
  [ match { $ev.preventDefault : !ev.preventDefault } ]
  ; to raw !path-input.value.trim
  [ match
   { [ propertyIs '' raw ] : !modal.navigate $modal.current-path }
   { true : !modal.navigate $raw }
  ]
 )
 !up-btn.addEventListener click (
  [ match
   { $modal.parent-path : !modal.navigate $modal.parent-path }
  ]
 )
 !refresh-btn.addEventListener click (
  !modal.load-roots
  !modal.navigate $modal.current-path
 )
 !filter-input.addEventListener input (
  ; set $filter-input.value modal.filter-query
  !render-directories
 )
 !hidden-btn.addEventListener click (
  ; set [ ternary $modal.show-hidden false true ] modal.show-hidden
  !sync-controls
  !render-directories
 )
 !new-folder-btn.addEventListener click (
  ; set false new-folder-row.hidden
  ; set '' new-folder-input.value
  [ match { $new-folder-input.focus : !new-folder-input.focus [ object { preventScroll true } ] } ]
 )
 !new-folder-cancel.addEventListener click (
  ; set true new-folder-row.hidden
  ; set '' new-folder-input.value
  !set-error ''
 )
 !new-folder-row.addEventListener submit (
  ; to { ev } $argv
  [ match { $ev.preventDefault : !ev.preventDefault } ]
  !modal.create-folder $new-folder-input.value
 )

 !close-btn.addEventListener click $modal.cancel
 !cancel-btn.addEventListener click $modal.cancel
 !default-btn.addEventListener click $modal.use-default
 !select-btn.addEventListener click $modal.use-selected
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.cancel
 )
 [ match
  { $window.addEventListener (
   !window.addEventListener keydown (
    ; to { ev } $argv
    ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.cancel
   )
  ) }
 ]

 $modal
)
$scope
