use i26s02004_iot_dev
select * from data_ot --* (iot)
select * from data_ot where _NAME LIKE 'M1003%'
select count(*) from data_ot where _NAME LIKE '%Kwh%' --5856270/8698436 
select * from data_ot where _NAME LIKE 'M1003%'--ghi taij moocs thowif gian, tawng 0,1 số guiwr  1 lần, có trạng thái
--_NAME PM
select * from tbl_status --định danh trạng thái máy tương tự data_machine_status 

use i26s02004_dat_dev
select * from data_machine_issue
SELECT * FROM data_machine_work_status
SELECT * FROM data_iot_convert order by machine_id ASC -->status id
select * from data_machine_status
select * from data_machine_component --các thành phần máy
--Vị trí máy 
select * from machine_location_his dlh
join data_location dl on dlh.location_id = dl.id
join data_machine dm on dlh.machine_id = dm.id

--nhóm máy
select * from data_machine dm 
join data_machine_group dmg on dm.machine_group_id = dmg.id

select * from data_machine_group
--dữ liệu bảo trì
select * from data_machine_maintenance_his
select * from data_maintenance
--Danh mục các công việc bảo trì
select *, group_machine_id from data_maintenance
where is_deleted = 0 and is_parent_node = 0
---người dùng báo cáo sự cố
select * from data_machine_issue

--Định danh lỗi
select * from data_error
select * from data_error_group


use i26s02004_dat_dev
select * from data_follow_iot
--hanf
select * from welding_parameter_lookup
--end
select top(100) * from data_machine_signal_his--* Bảng dữ liệu thô kéo về
select top(100) * from data_iot_convert --bắn số điện theo giai đoạn trạng thái/ phiên -> bỏ yêu cầu khoảng thời gian của mô hình
select * from data_machine
--Vị trí máy 
select * from machine_location_his dlh
join data_location dl on dlh.location_id = dl.id
join data_machine dm on dlh.machine_id = dm.id




select * from data_machine_status --định danh trạng thái máy




select * from data_cabinetglobal_kwh
select * from data_cabinet_cabinetglobal


















select * from data_iot_liquid



select * from data_iot_liquid_status
select * from data_iot_convert_daily

--trạng thái