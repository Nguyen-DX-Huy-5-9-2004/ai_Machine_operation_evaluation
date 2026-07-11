select * from data_iot_convert
inner join data_machine on data_iot_convert.machine_id = data_machine.id
inner join data_machine_status on data_iot_convert.status_id = data_machine_status.id
LEFT JOIN data_machine_repair r
ON r.machine_id=i.machine_id
AND r.repair_date
BETWEEN i.status_time_start
AND i.status_time_end

inner join data_machine_repair on data_iot_convert.machine_id= data_machine_repair.machine_id
select * from data_machine
select * from data_machine_repair

SELECT COUNT(*) FROM data_iot_convert
SELECT COUNT(*)
FROM (
    SELECT ...
) t

inner join machine_location_his on machine_location_his.machine_id = data_machine.id 
inner join data_location on machine_location_his.location_id = data_location.id --1 máy có thể nhiều vị trí, dữ liệu vị trí cũng không càn cho AI



select * from data_error
select * from data_machine_issue
select * from data_error_group
select * from data_machine_component
select * from data_machine_group

select * from data_electric_cabinet
select * from data_machine_electric_cabinet--tủ điện
select * from data_cabinetglobal_kwh

select * from data_electric_cabinetglobal
select * from data_machine_electric_cabinetglobal--tủ điện tổng 


select * from machine_location_his dlh
join data_location dl on dlh.location_id = dl.id
join data_machine dm on dlh.machine_id = dm.id order by machine_id


SELECT
r.id,
COUNT(*) as matched
FROM data_machine_repair r
LEFT JOIN data_iot_convert i
ON i.machine_id=r.machine_id
AND r.repair_date BETWEEN
i.status_time_start
AND i.status_time_end
GROUP BY r.id
order by r.id desc
select * from data_machine_repair

SELECT
    i.id,
    COUNT(r.id) AS repair_count
FROM data_iot_convert i
LEFT JOIN data_machine_repair r
    ON i.machine_id = r.machine_id
   AND r.repair_date BETWEEN i.status_time_start AND i.status_time_end
GROUP BY i.id
HAVING COUNT(r.id) > 1;

SELECT
    a.Col1,
    b.Col2,
    c.Col3
FROM TableA a
INNER JOIN TableB b
    ON a.ID = b.A_ID
INNER JOIN TableC c
    ON b.ID = c.B_ID;