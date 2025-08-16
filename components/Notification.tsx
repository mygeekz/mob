
import React, { useEffect } from 'react';
import { NotificationMessage } from '../types';

interface NotificationProps {
  message: NotificationMessage | null;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-close after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  let bgColor = 'bg-gray-700 hover:bg-gray-800';
  let iconClass = 'fa-solid fa-bell';

  switch (message.type) {
    case 'success':
      bgColor = 'bg-green-500 hover:bg-green-600';
      iconClass = 'fa-solid fa-check-circle';
      break;
    case 'error':
      bgColor = 'bg-red-600 hover:bg-red-700';
      iconClass = 'fa-solid fa-exclamation-triangle';
      break;
    case 'warning':
      bgColor = 'bg-yellow-500 hover:bg-yellow-600 text-black'; // Text black for better contrast on yellow
      iconClass = 'fa-solid fa-exclamation-circle';
      break;
    case 'info':
      bgColor = 'bg-blue-500 hover:bg-blue-600';
      iconClass = 'fa-solid fa-info-circle';
      break;
  }

  const baseStyles = "fixed bottom-5 right-5 p-4 rounded-lg shadow-xl text-white text-right z-50 transition-all duration-300 ease-in-out min-w-[300px] max-w-md";
  
  return (
    <div className={`${baseStyles} ${bgColor}`} role="alert" dir="rtl">
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          <i className={`${iconClass} text-xl ${message.type === 'warning' ? 'text-black/70' : 'text-white/80'}`}></i>
        </div>
        <div className="mr-3 flex-1">
          <p className={`font-medium ${message.type === 'warning' ? 'text-black' : 'text-white'}`}>{message.text}</p>
        </div>
        <div className="mr-2">
           <button 
            onClick={onClose} 
            className={`text-xl font-bold leading-none hover:opacity-75 focus:outline-none ${message.type === 'warning' ? 'text-black/70' : 'text-white/70'}`}
            aria-label="بستن"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notification;