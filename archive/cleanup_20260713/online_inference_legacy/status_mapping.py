from __future__ import annotations
from dataclasses import dataclass
from typing import Dict

@dataclass(frozen=True)
class StatusSemantics:
    status_id:int; status_type_code:str; current_signal_code:str
    is_on:int; is_loaded:int; is_no_load:int; is_current_near_zero:int
    has_error_token:int; has_maintenance_token:int
    known_fault_status:int; known_maintenance_status:int; known_repair_status:int; off_with_fault_status:int
    info_status:int; normal_loaded_production_status:int; normal_no_load_production_status:int
    power_on_near_zero_status:int; normal_power_off_status:int; status_evidence_class:str

STATUS_MAP: Dict[int, StatusSemantics] = {
 1: StatusSemantics(1,'POWER_ON','ON_CURRENT_NEAR_ZERO',1,0,1,1,0,0,0,0,0,0,0,0,0,1,0,'POWER_ON_NEAR_ZERO'),
 2: StatusSemantics(2,'RUN_PRODUCTION_NO_LOAD','ON_NO_LOAD',1,0,1,1,0,0,0,0,0,0,0,0,1,0,0,'NORMAL_NO_LOAD_PRODUCTION'),
 3: StatusSemantics(3,'RUN_PRODUCTION_LOADED','ON_LOADED',1,1,0,0,0,0,0,0,0,0,0,1,0,0,0,'NORMAL_LOADED_PRODUCTION'),
 4: StatusSemantics(4,'RUN_MAINTENANCE_NO_LOAD','ON_NO_LOAD_MAINTENANCE',1,0,1,1,0,1,0,1,0,0,0,0,0,0,0,'MAINTENANCE_STATUS'),
 5: StatusSemantics(5,'RUN_MAINTENANCE_LOADED','ON_LOADED_MAINTENANCE',1,1,0,0,0,1,0,1,0,0,0,0,0,0,0,'MAINTENANCE_STATUS'),
 6: StatusSemantics(6,'RUN_REPAIR_NO_LOAD','ON_NO_LOAD_REPAIR',1,0,1,1,1,1,1,1,1,0,0,0,0,0,0,'REPAIR_STATUS'),
 7: StatusSemantics(7,'RUN_REPAIR_LOADED','ON_LOADED_REPAIR',1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,'REPAIR_STATUS'),
 8: StatusSemantics(8,'POWER_OFF','OFF_NORMAL',0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,'NORMAL_POWER_OFF'),
 9: StatusSemantics(9,'POWER_OFF_FAULT','OFF_WITH_FAULT',0,0,1,1,1,0,1,0,0,1,0,0,0,0,0,'OFF_WITH_FAULT'),
 10: StatusSemantics(10,'POWER_OFF_MAINTENANCE','OFF_MAINTENANCE',0,0,1,1,1,1,1,1,0,1,0,0,0,0,0,'OFF_WITH_FAULT'),
}

def get_status_semantics(status_id:int)->StatusSemantics:
    return STATUS_MAP.get(int(status_id), StatusSemantics(int(status_id),'UNKNOWN','UNKNOWN',0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,'UNKNOWN_STATUS'))
