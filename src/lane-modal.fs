-- file lane-modal.fs
; to scope ; object
; to scope.create (
 -- Creates a full-screen modal for browsing, opening, and closing known lanes
 ; to { lane-control } $argv
 ; to backdrop !document.createElement div
 ; set lane-modal-backdrop backdrop.className
 ; to panel !document.createElement div
 ; set lane-modal panel.className
 ; to header !document.createElement div
 ; set lane-modal-header header.className
 ; to title-wrap !document.createElement div
 ; set lane-modal-title-wrap title-wrap.className
 ; to heading !document.createElement div
 ; assign $heading { className lane-modal-title } { textContent 'Open Lane' }
 ; to count-el !document.createElement div
 ; set lane-modal-count count-el.className
 ; to close-btn !document.createElement button
 ; assign $close-btn { type button } { className lane-modal-close } { textContent '×' } { title 'Close (Esc)' }
 ; to search-input !document.createElement input
 ; assign $search-input { type text } { className lane-modal-search } { placeholder 'Filter lanes by title or ID...' } { spellcheck false } { autocomplete off }
 ; to list-el !document.createElement div
 ; set lane-modal-list list-el.className

 !title-wrap.appendChild $heading
 !title-wrap.appendChild $count-el
 !header.appendChild $title-wrap
 !header.appendChild $close-btn
 !panel.appendChild $header
 !panel.appendChild $search-input
 !panel.appendChild $list-el
 !backdrop.appendChild $panel

 ; to modal [ object
  { backdrop $backdrop }
  { panel $panel }
  { search-input $search-input }
  { list-el $list-el }
  { count-el $count-el }
  { close-btn $close-btn }
  { is-open false }
  { query '' }
  { known {} }
  { row-els {} }
  { items {} }
 ]

 ; to modal.close (
  -- Closes the full-screen lanes modal
  ; condition { propertyIs true modal.is-open } (
   ; set false modal.is-open
   !backdrop.remove
  )
 )

 ; to modal.render (
  -- Renders filtered known lanes with Open/Close controls
  ; while { propertyIsGreaterThan 0 modal.row-els.length } (
   ; to old-el !modal.row-els.pop
   !old-el.remove
  )
  ; set 0 modal.items.length
  ; to q-trimmed !modal.query.trim
  ; to q !q-trimmed.toLowerCase
  ; to matches {}
  ; each $modal.known (
   ; to { entry } $argv
   ; to hay-raw ; add $entry.title ; add ' ' $entry.id
   ; to hay !hay-raw.toLowerCase
   ; to hit [ match
    { [ propertyIs '' q ] : true }
    { [ !hay.includes $q ] : true }
    { true : false }
   ]
   [ match
    { $hit : !matches.push $entry }
   ]
  )
  ; to total $modal.known.length
  ; to shown $matches.length
  ; to count-label [ match
   { [ propertyIs '' q ] (
    ; to noun [ match
     { [ propertyIs 1 total ] : ' lane' }
     { true : ' lanes' }
    ]
    ; add $total $noun
   ) }
   { true : ; add $shown ; add ' of ' ; add $total ' lanes' }
  ]
  ; set $count-label count-el.textContent

  [ match
   { [ propertyIs 0 shown ] (
    ; to empty-el !document.createElement div
    ; set lane-modal-empty empty-el.className
    ; to empty-msg [ match
     { [ propertyIs 0 total ] : 'No saved lanes yet. Click + Lane to create one.' }
     { true : 'No matching lanes.' }
    ]
    ; set $empty-msg empty-el.textContent
    !list-el.appendChild $empty-el
    !modal.row-els.push $empty-el
   ) }
   { true (
    ; each $matches (
     ; to { entry } $argv
     ; to row-el !document.createElement div
     ; set lane-modal-item row-el.className
     ; to info-el !document.createElement div
     ; set lane-modal-item-info info-el.className
     ; to item-title !document.createElement div
     ; assign $item-title { className lane-modal-item-title } { textContent $entry.title }
     ; to item-id !document.createElement div
     ; assign $item-id { className lane-modal-item-id } { textContent $entry.id }
     !info-el.appendChild $item-title
     !info-el.appendChild $item-id
     ; to actions-el !document.createElement div
     ; set lane-modal-item-actions actions-el.className
     ; to open-lane [ get lane-control.by-id $entry.id ]
     ; to item-record [ object
      { entry $entry }
      { el $row-el }
      { is-open [ ternary $open-lane true false ] }
     ]
     [ match
      { $open-lane (
       ; to badge !document.createElement span
       ; assign $badge { className lane-modal-badge } { textContent Open }
       ; to item-close-btn !document.createElement button
       ; assign $item-close-btn { type button } { className 'lane-modal-action lane-modal-action--close' } { textContent Close }
       !item-close-btn.addEventListener click (
        !lane-control.close $entry.id
        !modal.render
       )
       !actions-el.appendChild $badge
       !actions-el.appendChild $item-close-btn
       ; set $item-close-btn item-record.close-btn
      ) }
      { true (
       ; to item-open-btn !document.createElement button
       ; assign $item-open-btn { type button } { className 'lane-modal-action lane-modal-action--open' } { textContent Open }
       !item-open-btn.addEventListener click (
        !lane-control.open $entry.id
        !lane-control.update-url
        !modal.close
       )
       !actions-el.appendChild $item-open-btn
       ; set $item-open-btn item-record.open-btn
      ) }
     ]
     !row-el.appendChild $info-el
     !row-el.appendChild $actions-el
     !list-el.appendChild $row-el
     !modal.row-els.push $row-el
     !modal.items.push $item-record
    )
   ) }
  ]
 )

 ; to modal.open (
  -- Loads all known lanes from KV and displays the full-screen modal
  ; set '' modal.query
  ; set '' search-input.value
  ; to known !lane-control.list-known
  ; set $known modal.known
  ; condition { propertyIs false modal.is-open } (
   ; set true modal.is-open
   !document.body.appendChild $backdrop
  )
  !modal.render
  [ match
   { $search-input.focus : !search-input.focus }
  ]
  $modal
 )

 !close-btn.addEventListener click $modal.close
 !backdrop.addEventListener click (
  ; to { ev } $argv
  ; condition { propertyIs $backdrop ev.target } : !modal.close
 )
 !search-input.addEventListener input (
  ; set $search-input.value modal.query
  !modal.render
 )
 !window.addEventListener keydown (
  ; to { ev } $argv
  ; condition { propertyIs true modal.is-open } : ; condition { propertyIs Escape ev.key } : !modal.close
 )

 $modal
)
$scope
