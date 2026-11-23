; to scope ; object
[ to scope add (
 ; invoke { lane-control--add ; get argv } console log
 ; to new-lane-element ; invoke { } [ invoke {} scope create-lane ] pop
 ; set NewLaneElement new-lane-element textContent
 ; invoke { new lane ; get new-lane-element } console log
) ]
; invoke { ; get scope } console log
; get scope
