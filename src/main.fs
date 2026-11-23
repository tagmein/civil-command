; comment file main.fs
; set #202020 document body style backgroundColor
[
 set
 '"IBM Plex Mono", monospace, Arial, "Noto Sans", Verdana, sans-serif'
 document body style fontFamily
]
; set 13px document body style fontSize
; to message ; invoke { div } document createElement
; set 'Civil Command\n\nHome\n ' message textContent
; invoke { ; get message } document body appendChild
; invoke { ; get data } console log
; set [ object ] state
= ; set [ invoke { @1 } data get ] state @1
 session
= ; to @1 ; invoke { @2 } document createElement
 table table
 tableHead thead
 tableHeadRow tr
 tableHeadRowAdd th
 tableHeadRowAddButton button
=
; set '+ Lane' tableHeadRowAddButton textContent
= ; invoke { ; get @1 } @2+ appendChild
 tableHeadRowAddButton tableHeadRowAdd
 tableHeadRowAdd tableHeadRow
 tableHeadRow tableHead
 tableHead table
 table document body
=
; to lane-control ; invoke {} [ load ./src/lane-control.fs ] pop
; to lane-control create-lane (
 ; set [ invoke { th } document createElement ] new-lane-th
 ; invoke { ; get new-lane-th } tableHeadRow appendChild
 ; get new-lane-th
)
; invoke { Lane Control ; get lane-control } console log
; invoke { click ; get lane-control add } tableHeadRowAddButton addEventListener
