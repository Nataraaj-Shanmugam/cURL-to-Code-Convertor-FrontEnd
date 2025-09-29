import React from 'react';
import { useAppDispatch } from '../state/hooks';
import { executeRequest } from '../utils/execution';

export const ExecutionPanel: React.FC = () => {
  const dispatch = useAppDispatch();

  const handleExecute = async () => {
    try {
      dispatch({ type: 'SET_IS_EXECUTING', payload: true });

      const { results, status } = await executeRequest();

      dispatch({
        type: 'SET_EXECUTION_RESULTS',
        payload: { results, status }
      });
    } catch (err: any) {
      dispatch({
        type: 'SET_EXECUTION_RESULTS',
        payload: { results: '', status: undefined, error: err.message || 'Execution failed' }
      });
    } finally {
      dispatch({ type: 'SET_IS_EXECUTING', payload: false });
    }
  };

  return (
    <div className="section">
      <div className="section-header">⚡ Execution Panel</div>
      <div className="section-content">
        <button
          className="btn"
          onClick={handleExecute}
        >
          Run Request
        </button>
      </div>
    </div>
  );
};
