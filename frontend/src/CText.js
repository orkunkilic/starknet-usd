import { Text } from '@geist-ui/core'
import React from 'react'

function CText({ children, ...props }) {
  return (
    <Text style={{color: '#fee'}} {...props}>{children}</Text>
  )
}

export default CText