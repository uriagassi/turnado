import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoctorFormScreen } from "./DoctorFormScreen";
import type { Doctor } from "../api";

describe("DoctorFormScreen", () => {
  it("renders labeled inputs for every doctor field", () => {
    render(<DoctorFormScreen onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Specialty")).toBeInTheDocument();
    expect(screen.getByLabelText("Clinic")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByLabelText("Photo")).toBeInTheDocument();
  });

  it("submits the filled-in fields as a DoctorInput", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DoctorFormScreen onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Dr. Jane Smith");
    await user.type(screen.getByLabelText("Specialty"), "Cardiology");
    await user.type(screen.getByLabelText("Clinic"), "Riverside Clinic");
    await user.type(screen.getByLabelText("Phone"), "555-1234");
    await user.type(screen.getByLabelText("Address"), "12 Elm St");
    await user.type(screen.getByLabelText("Email"), "jane.smith@example.com");
    await user.type(screen.getByLabelText("Notes"), "Prefers morning appointments");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(
      {
        name: "Dr. Jane Smith",
        specialty: "Cardiology",
        clinic: "Riverside Clinic",
        phone: "555-1234",
        address: "12 Elm St",
        email: "jane.smith@example.com",
        notes: "Prefers morning appointments",
      },
      null,
    );
  });

  it("submits the selected photo file alongside the fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DoctorFormScreen onSubmit={onSubmit} onCancel={() => {}} />);
    const photo = new File(["fake-image-bytes"], "portrait.jpg", { type: "image/jpeg" });

    await user.type(screen.getByLabelText("Name"), "Dr. Jane Smith");
    await user.type(screen.getByLabelText("Notes"), "Prefers morning appointments");
    await user.upload(screen.getByLabelText("Photo"), photo);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][1]).toBe(photo);
  });

  it("blocks submission and shows an error when the name is left blank", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DoctorFormScreen onSubmit={onSubmit} onCancel={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("submits successfully with notes left blank, since only the name is required", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DoctorFormScreen onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Dr. Jane Smith");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.queryByText("Notes is required.")).not.toBeInTheDocument();
  });

  it("pre-fills the fields from an existing doctor when editing", () => {
    const doctor: Doctor = {
      id: 1,
      name: "Dr. Jane Smith",
      specialty: "Cardiology",
      clinic: "Riverside Clinic",
      phone: "555-1234",
      address: "12 Elm St",
      email: "jane.smith@example.com",
      notes: "Prefers morning appointments",
      photoPath: null,
    };

    render(<DoctorFormScreen doctor={doctor} onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Dr. Jane Smith");
    expect(screen.getByLabelText("Specialty")).toHaveValue("Cardiology");
    expect(screen.getByLabelText("Clinic")).toHaveValue("Riverside Clinic");
    expect(screen.getByLabelText("Phone")).toHaveValue("555-1234");
    expect(screen.getByLabelText("Address")).toHaveValue("12 Elm St");
    expect(screen.getByLabelText("Email")).toHaveValue("jane.smith@example.com");
    expect(screen.getByLabelText("Notes")).toHaveValue("Prefers morning appointments");
  });

  it("shows the doctor's current photo when editing one that already has a photo", () => {
    const doctor: Doctor = {
      id: 1,
      name: "Dr. Jane Smith",
      notes: "Prefers morning appointments",
      photoPath: "1-1700000000000.jpg",
    };

    render(<DoctorFormScreen doctor={doctor} onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByTestId("doctor-avatar").querySelector("img")).toHaveAttribute("src", "/photos/1-1700000000000.jpg");
  });

  it("calls onCancel when the cancel control is activated", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<DoctorFormScreen onSubmit={() => {}} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
