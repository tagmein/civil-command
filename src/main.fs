-- file main.fs
; to window $document.defaultView
; to crypto $window.crypto
; to history $window.history
; to location $window.location
[ assign document.body.style
 { backgroundColor #202020 }
 { fontFamily '"IBM Plex Mono", monospace, Arial, "Noto Sans", Verdana, sans-serif' }
 { fontSize 13px }
]
; to message !document.createElement div
; set 'Civil Command\n\nHome\n ' message.textContent
!document.body.appendChild $message
!console.log $data
; to state ; object
= ; set [ !data.get @1 ] state @1
 session
= ; to @1 !document.createElement @2
 table table
 tableHead thead
 tableHeadRow tr
 tableHeadRowAdd th
 tableHeadRowControls div
 tableHeadRowAddButton button
 tableHeadRowOpenButton button
 tableBody tbody
 tableBodyRow tr
 tableBodyRowSpacer td
=
; set lanes-table table.className
; set lane-controls tableHeadRowControls.className
; assign $tableHeadRowAddButton { type button } { className lane-control-btn } { textContent '+ Lane' }
; assign $tableHeadRowOpenButton { type button } { className lane-control-btn } { textContent Open }
= !@2+.appendChild $@1
 tableHeadRowAddButton tableHeadRowControls
 tableHeadRowOpenButton tableHeadRowControls
 tableHeadRowControls tableHeadRowAdd
 tableHeadRowAdd tableHeadRow
 tableHeadRow tableHead
 tableHead table
 tableBodyRowSpacer tableBodyRow
 tableBodyRow tableBody
 tableBody table
 table document body
=
; to lane-control ; load /src/lane-control.fs
; to lane-control.create-lane (
 -- Creates header and notebook body cells for a lane column
 ; to header !document.createElement th
 ; set lane-header header.className
 !tableHeadRow.appendChild $header
 ; to body !document.createElement td
 ; set lane-body body.className
 !tableBodyRow.appendChild $body
 ; object { header $header } { body $body }
)
; to lane-modal-mod ; load /src/lane-modal.fs
; to lane-modal !lane-modal-mod.create $lane-control
; to lanes $lane-control.lanes
!console.log Lane Control $lane-control
!lane-control.init
!tableHeadRowAddButton.addEventListener click $lane-control.add
!tableHeadRowOpenButton.addEventListener click $lane-modal.open
