-- file lane-output.fs
; to scope ; object
; to scope.mount (
 -- Mounts a mini browser window ("Lane Output") below a lane that executes transported FieldScript blocks in browser context
 ; to { lane container } $argv
 ; to view [ object
  { lane $lane }
  { container $container }
  { packets {} }
  { results {} }
  { state ; object }
  { error-els {} }
  { render-id 0 }
  { always-visible false }
 ]

 ; to root-el !document.createElement div
 ; set lane-output root-el.className
 !root-el.setAttribute role region
 !root-el.setAttribute aria-label 'Lane Output'
 ; set true root-el.hidden

 ; to bar-el !document.createElement div
 ; set lane-output-bar bar-el.className

 ; to dots-el !document.createElement span
 ; set lane-output-dots dots-el.className
 !dots-el.setAttribute aria-hidden 'true'
 ; to dot-1 !document.createElement span
 ; set 'lane-output-dot lane-output-dot--red' dot-1.className
 ; to dot-2 !document.createElement span
 ; set 'lane-output-dot lane-output-dot--yellow' dot-2.className
 ; to dot-3 !document.createElement span
 ; set 'lane-output-dot lane-output-dot--green' dot-3.className
 !dots-el.appendChild $dot-1
 !dots-el.appendChild $dot-2
 !dots-el.appendChild $dot-3

 ; to address-el !document.createElement div
 ; assign $address-el { className lane-output-address } { textContent 'Lane Output' }

 ; to count-el !document.createElement span
 ; assign $count-el { className lane-output-count } { textContent '' }

 ; to reload-btn !document.createElement button
 ; assign $reload-btn { type button } { className lane-output-reload } { textContent '↻' } { title 'Re-run sent scripts' }
 !reload-btn.setAttribute aria-label 'Re-run sent scripts'

 !bar-el.appendChild $dots-el
 !bar-el.appendChild $address-el
 !bar-el.appendChild $count-el
 !bar-el.appendChild $reload-btn

 ; to viewport-el !document.createElement div
 ; set lane-output-viewport viewport-el.className

 ; to empty-el !document.createElement div
 ; assign $empty-el { className lane-output-empty } { textContent 'No browser output yet. Use ; send ( ... ) in Source to render output.' } { hidden true }

 ; to errors-el !document.createElement div
 ; set lane-output-errors errors-el.className
 ; set true errors-el.hidden

 !root-el.appendChild $bar-el
 !root-el.appendChild $viewport-el
 !root-el.appendChild $empty-el
 !root-el.appendChild $errors-el
 !container.appendChild $root-el

 ; assign $view { element $root-el } { bar-el $bar-el } { address-el $address-el } { count-el $count-el } { reload-btn $reload-btn } { viewport-el $viewport-el } { empty-el $empty-el } { errors-el $errors-el }

 ; to view.sync-visibility (
  -- Updates output browser visibility based on packet count and View-tab always-visible mode
  ; to has-packets [ propertyIsGreaterThan 0 view.packets.length ]
  ; to show [ match
   { $has-packets : true }
   { $view.always-visible : true }
   { true : false }
  ]
  ; set [ ternary $show false true ] root-el.hidden
  ; set [ ternary $has-packets false true ] viewport-el.hidden
  ; set [ ternary $has-packets true false ] empty-el.hidden
  ; set [ ternary $view.always-visible 'lane-output lane-output--view' lane-output ] root-el.className
 )

 ; to view.set-always-visible (
  -- Enables or disables always-visible View mode for the output browser
  ; to { enabled } $argv
  ; set [ ternary $enabled true false ] view.always-visible
  !view.sync-visibility
 )

 ; to view.clear-viewport (
  -- Clears rendered DOM nodes from the mini-browser viewport
  [ match
   { $viewport-el.replaceChildren : !viewport-el.replaceChildren }
   { true (
    ; while { propertyIsGreaterThan 0 viewport-el.children.length } (
     ; to child !viewport-el.children.pop
     [ match
      { $child.remove : !child.remove }
     ]
    )
    ; set '' viewport-el.textContent
   ) }
  ]
 )

 ; to view.clear-errors (
  -- Clears any previous browser execution errors
  ; while { propertyIsGreaterThan 0 view.error-els.length } (
   ; to old-el !view.error-els.pop
   !old-el.remove
  )
  ; set true errors-el.hidden
 )

 ; to view.render (
  -- Collects transported FieldScript packets, resets the mini-browser viewport, and runs them in browser context
  ; to { raw-packets } $argv
  ; to packets [ match
   { [ !window.Array.isArray $raw-packets ] : $raw-packets }
   { true : {} }
  ]
  ; set $packets view.packets
  ; to next-render-id ; add $view.render-id 1
  ; set $next-render-id view.render-id
  !view.clear-viewport
  !view.clear-errors
  [ match
   { [ propertyIs 0 packets.length ] (
    ; set {} view.results
    ; to view.state ; object
    ; set '' count-el.textContent
    !view.sync-visibility
    null
   ) }
   { true (
    !view.sync-visibility
    ; to count-unit [ ternary [ propertyIs 1 packets.length ] ' script' ' scripts' ]
    ; to count-label ; add $packets.length $count-unit
    ; set $count-label count-el.textContent
    ; to run-opts [ object
     { document $document }
     { window $window }
     { console $console }
     { output $viewport-el }
     { isCancelled (
      ; ternary [ propertyIs $next-render-id view.render-id ] false true
     ) }
    ]
    ; to outcome !runTransportedScripts $packets $run-opts
    [ match
     { [ propertyIs $next-render-id view.render-id ] (
      ; set $outcome.results view.results
      ; set $outcome.state view.state
      ; each $outcome.results (
       ; to { res idx } $argv
       [ match
        { $res.error (
         ; to err-el !document.createElement div
         ; set lane-output-error err-el.className
         ; to prefix [ match
          { $res.lineNumber : ; add 'Line ' ; add $res.lineNumber ': ' }
          { true (
           ; to num ; add $idx 1
           ; add 'Script #' ; add $num ': '
          ) }
         ]
         ; to err-text ; add $prefix $res.error
         ; set $err-text err-el.textContent
         !errors-el.appendChild $err-el
         !view.error-els.push $err-el
         ; set false errors-el.hidden
        ) }
       ]
      )
     ) }
    ]
    $outcome
   ) }
  ]
 )

 ; to view.reload (
  -- Re-runs the last collected transported scripts in the mini-browser viewport
  !view.render $view.packets
 )

 !reload-btn.addEventListener click $view.reload
 $view
)
$scope
