import React, { useEffect, useState } from "react";
import { db } from "@/service/firebaseConfig";
import { collection, getDocs, getDoc, doc, updateDoc } from "firebase/firestore";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"; // Import styles
import './AdminBookings.css'; // Ensure your CSS file is imported
import axios from "axios";

function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state
  const [startDate, setStartDate] = useState(null); // Start date for filtering
  const [endDate, setEndDate] = useState(null); // End date for filtering

  // Fetch bookings when the component mounts
  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true); // Start loading
    try {
      const bookingsRef = collection(db, "UserBookings");
      const snapshot = await getDocs(bookingsRef);
      
      const bookingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setBookings(bookingsList);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setError("Failed to fetch bookings. Please try again later.");
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const handleAcceptBooking = async (id) => {
    try {
      // Update booking status to accepted
      await updateDoc(doc(db, "UserBookings", id), {
        isAccepted: true // Update the status to ACCEPTED
      });
  
      // Fetch the updated booking details
      const bookingRef = doc(db, "UserBookings", id);
      const bookingSnapshot = await getDoc(bookingRef);
      
      if (bookingSnapshot.exists()) {
        const bookingData = bookingSnapshot.data();
  
        // Ensure the date strings are valid
        const checkInDate = new Date(bookingData.checkInDate);
        const checkOutDate = new Date(bookingData.checkOutDate);
  
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
          throw new Error("Invalid date format in booking data.");
        }
  
        // Prepare the event details for Google Calendar
        const eventDetails = {
          summary: `Booking Confirmation for ${bookingData.fullName} at ${bookingData.hotelName}`, // Use userEmail instead of customerName
          location: bookingData.address, // Adjust according to your data structure
          description: `Booking Details: Check-in: ${checkInDate.toLocaleDateString()}, Check-out: ${checkOutDate.toLocaleDateString()}`, // Include other relevant details
          start: {
            dateTime: checkInDate.toISOString(), // Convert to ISO string
            timeZone: 'Asia/Manila', // Set timezone to Philippines
          },
          end: {
            dateTime: checkOutDate.toISOString(), // Convert to ISO string
            timeZone: 'Asia/Manila', // Set timezone to Philippines
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 }, // 1 day before the event
              { method: 'popup', minutes: 24 * 60 }, // 1 day before the event
            ],
          },
        };
  
        // Create the Google Calendar event
        await createGoogleCalendarEvent(eventDetails);
      }
  
      fetchBookings(); // Refresh the list after updating
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Failed to update booking status. Please try again.");
    }
  };

  const createGoogleCalendarEvent = async (eventDetails) => {
    // Retrieve the access token from local storage
    const accessToken = localStorage.getItem('googleAccessToken'); // Ensure this key matches how you stored it
  
    if (!accessToken) {
      console.error("No access token found. Please authenticate again.");
      alert("Authentication is required. Please sign in to Google.");
      return;
    }
  
    try {
      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        eventDetails,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
  
      console.log("Event created successfully:", response.data);
    } catch (error) {
      console.error("Failed to create calendar event:", error.response?.data || error.message);
      alert("Error creating calendar event: " + (error.response?.data?.error?.message || error.message));
    }
  };

  


  const toggleActiveStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, "UserBookings", id), {
        isActive: !currentStatus // Toggle the isActive status
      });
      fetchBookings(); // Refresh the list after updating
    } catch (error) {
      console.error("Error updating booking status:", error);
      alert("Failed to update booking status. Please try again.");
    }
  };

  // Filter bookings based on selected dates
  const filteredBookings = bookings.filter(booking => {
    const checkInDate = new Date(booking.checkInDate);
    const checkOutDate = new Date(booking.checkOutDate);

    return (
      (!startDate || checkInDate >= new Date(startDate)) &&
      (!endDate || checkOutDate <= new Date(endDate))
    );
  });

  return (
    <div className="admin-bookings-container">
      <h1>Admin Bookings</h1>
      
      <div className='border border-gray-300 bg-transparent rounded-md mt-5 p-3 date-filters grid grid-cols-2 gap-20'>
        <label className="ml-auto">
          Start Date:
          <DatePicker 
            className='border border-gray-300 bg-transparent rounded-md  p-2 '
            selected={startDate} 
            onChange={(date) => setStartDate(date)} 
            dateFormat="yyyy-MM-dd"
          />
        </label>
        <label>
          End Date:
          <DatePicker 
            className='border border-gray-300 bg-transparent rounded-md p-2'
            selected={endDate} 
            onChange={(date) => setEndDate(date)} 
            dateFormat="yyyy-MM-dd"
          />
        </label>
      </div>

      {loading ? (
        <p>Loading bookings...</p> // Loading indicator
      ) : error ? (
        <p className="error-message">{error}</p> // Display error message
      ) : (
        <table className="bookings-table">
          <thead>
            <tr>
              <th>User Email</th>
              <th>Hotel Name</th>
              <th>Check-in Date</th>
              <th>Check-out Date</th>
              <th>Progress</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.userEmail}</td>
                  <td>{booking.hotelName}</td>
                  <td>{new Date(booking.checkInDate).toLocaleDateString()}</td>
                  <td>{new Date(booking.checkOutDate).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => toggleActiveStatus(booking.id, booking.isActive)} 
                      className={`button1 ${booking.isActive ? "active-button" : "inactive-button"}`}
                    >
                      {booking.isActive ? "CO" : "CI"}
                    </button>
                  </td>
                  <td>
                    {booking.isAccepted ? (
                      'IN PROGRESS'
                    ) : (
                      <button onClick={() => handleAcceptBooking(booking.id)} className="button1 accept-button">
                        Accept
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">No bookings found.</td> {/* Message for no bookings */}
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminBookings;