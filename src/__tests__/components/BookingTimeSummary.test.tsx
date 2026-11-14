import {render,screen} from "@testing-library/react";
import BookingTimeSummary from "@/components/appointments/BookingTimeSummary";
test("confirmation identifies doctor timezone and converts the actual booking instant",()=>{
 render(<BookingTimeSummary instant={new Date("2026-01-10T01:30:00Z")} doctorTimeZone="Africa/Lagos" locale="en-GB"/>);
 expect(screen.getByText("Doctor local time (Africa/Lagos)")).toBeInTheDocument();expect(screen.getByText(/02:30/)).toBeInTheDocument();
});
test("missing doctor timezone is unavailable",()=>{render(<BookingTimeSummary instant={new Date()} doctorTimeZone={null} locale="en"/>);expect(screen.getByRole("status")).toHaveTextContent("must configure a timezone");});
