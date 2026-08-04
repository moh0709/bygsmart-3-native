import React from 'react';
import { useMatch } from 'react-router-dom';
import Chatbot from './Chatbot';

const ChatbotController: React.FC = () => {
  const projectMatch = useMatch('/project-detail/:id');
  const projectId = projectMatch?.params.id;

  // The AI chat is dedicated to a project — only mount it inside a project.
  if (!projectId) {
      return null;
  }

  return <Chatbot contextId={`project-${projectId}`} />;
};

export default ChatbotController;