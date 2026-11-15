import type {User as AuthUser} from "@supabase/supabase-js";
import type {User,Patient,Doctor,Prescription,Vital,LabOrder,LabResult,AmeliaConversation,AmeliaMessage,Referral,MedicalNote} from "@prisma/client";
// A Prisma query may select a subset of columns. These projections retain the
// generated column types without pretending every fixture is a full database row.
export type AuthReply={data:{user:(Pick<AuthUser,"id">&Partial<Pick<AuthUser,"email"|"phone"|"user_metadata"|"app_metadata">>)|null};error?:{message?:string}|null};
export type UserProjection=Partial<User>&{patient?:PatientProjection|null;doctor?:(Partial<Doctor>&{user?:Partial<User>})|null};
export type PatientProjection=Partial<Patient>&{user?:Partial<User>;vitals?:Partial<Vital>[];prescriptions?:Partial<Prescription>[];labOrders?:(Partial<LabOrder>&{results?:Partial<LabResult>[]})[];medicalNotes?:Partial<MedicalNote>[];appointments?:Partial<import("@prisma/client").Appointment>[]};
export type ConversationProjection=Partial<AmeliaConversation>&{messages?:Partial<AmeliaMessage>[]};
export type DoctorProjection=Partial<Doctor>&{user?:Partial<User>};
export type ReferralProjection=Partial<Referral>&{referringDoctor?:DoctorProjection;referredDoctor?:DoctorProjection};
export type NoteProjection=Partial<MedicalNote>&{doctor?:DoctorProjection};
export type PrescriptionProjection=Partial<Prescription>&{doctor?:DoctorProjection|null;patient?:PatientProjection};
