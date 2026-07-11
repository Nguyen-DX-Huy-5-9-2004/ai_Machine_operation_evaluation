SELECT *
FROM data_iot_convert
INNER JOIN data_machine
    ON data_iot_convert.machine_id = data_machine.id
INNER JOIN data_machine_status
    ON data_iot_convert.status_id = data_machine_status.id
LEFT JOIN data_machine_repair
    ON data_machine_repair.machine_id = data_iot_convert.machine_id
   AND data_machine_repair.repair_date BETWEEN
       data_iot_convert.status_time_start
   AND data_iot_convert.status_time_end;

   SELECT COUNT(*)
FROM data_iot_convert;

select *, group_machine_id from data_maintenance
where is_deleted = 0 and is_parent_node = 0

select * from data_machine_issue --nguoi dung push 

select * from data_error

select * from data_error_group