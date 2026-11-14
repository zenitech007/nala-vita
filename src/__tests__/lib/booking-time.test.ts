import {bookingInstant} from "@/lib/booking-time";
test("date-only input preserves the selected local calendar day",()=>{
 const date=bookingInstant("2026-11-14","09:30 AM");expect([date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes()]).toEqual([2026,11,14,9,30]);
});
test.each(["00:30 AM","13:30 PM","09:99 AM"])("rejects invalid clock %s",time=>expect(()=>bookingInstant("2026-11-14",time)).toThrow());
